import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import {
  applyWebhookEvent,
  currentMonthWindow,
  ensureStripeCustomerId,
  getSubscriptionForCompany,
  getSubscriptionPlan,
  getTopUpOption,
  listTransactionHistory,
  listUsageBreakdownByAgent,
  resolvePriceId,
  SUBSCRIPTION_PLANS,
  TOP_UP_OPTIONS,
} from "../billing/index.js";
import { getCompanyBalanceCents } from "../ledger/operations.js";
import { LocalServerInfoProvider, type ServerInfoProvider } from "../server-info/index.js";
import { StripeSignatureError, type StripeClient } from "../stripe/index.js";
import type { CreditLedgerEntry } from "../schema.js";
import {
  companyIdParamSchema,
  createPortalBodySchema,
  createSubscriptionCheckoutBodySchema,
  createTopUpCheckoutBodySchema,
  transactionHistoryQuerySchema,
} from "./schemas.js";

export interface PluginPaymentsActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginPaymentsRouterDeps {
  readonly db: Db;
  readonly stripe: StripeClient;
  /** Secret passed to Stripe's signature verifier. Operator sets via env. */
  readonly webhookSecret: string;
  /** Process env used for Stripe price id lookup; defaults to process.env. */
  readonly env?: NodeJS.ProcessEnv;
  /**
   * B-08 Server settings tab. Defaults to `LocalServerInfoProvider` until A-09's
   * Fly-aware impl arrives; the host mount can swap it without router changes.
   */
  readonly serverInfo?: ServerInfoProvider;
  /** Optional `now` override for the Usage tab's "this month" window. Tests use this. */
  readonly now?: () => Date;
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
  readonly resolveActorInfo: (req: Request) => PluginPaymentsActorInfo;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parseParams<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function parseBody<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function parseQuery<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  return parsed.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`)
    .join("; ");
}

/**
 * Plugin-payments HTTP router (B-07 + B-08).
 *
 *   B-07 (checkout / portal / webhook):
 *     GET    /api/companies/:companyId/plugin-payments/subscription
 *     GET    /api/companies/:companyId/plugin-payments/catalog
 *     POST   /api/companies/:companyId/plugin-payments/checkout/subscription
 *     POST   /api/companies/:companyId/plugin-payments/checkout/top-up
 *     POST   /api/companies/:companyId/plugin-payments/portal
 *     POST   /api/webhooks/stripe   (no companyId scope; stripe-signature verifies)
 *
 *   B-08 (settings tabs):
 *     GET    /api/companies/:companyId/plugin-payments/billing/summary
 *     GET    /api/companies/:companyId/plugin-payments/usage/summary
 *     GET    /api/companies/:companyId/plugin-payments/usage/transactions
 *     GET    /api/companies/:companyId/plugin-payments/server/info
 *
 * The webhook endpoint is NOT under /api/companies/:companyId — Stripe
 * doesn't know our company ids; the handler looks up the company from
 * `billing_customers.stripe_customer_id` instead.
 */
export function createPluginPaymentsRouter(deps: PluginPaymentsRouterDeps): Router {
  const router = Router();
  const env = deps.env ?? process.env;
  const serverInfo = deps.serverInfo ?? new LocalServerInfoProvider();
  const now = deps.now ?? (() => new Date());

  router.get(
    "/companies/:companyId/plugin-payments/subscription",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const row = await getSubscriptionForCompany(deps.db, companyId);
      res.json({ subscription: row ? toSubscriptionDto(row) : null });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-payments/catalog",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      res.json({
        plans: Object.values(SUBSCRIPTION_PLANS).map((p) => ({
          key: p.key,
          displayName: p.displayName,
          monthlyPriceCents: p.monthlyPriceCents,
          priceConfigured: resolvePriceId(env, p) !== null,
        })),
        topUps: TOP_UP_OPTIONS.map((o) => ({
          credits: o.credits,
          amountCents: o.amountCents,
          priceConfigured: resolvePriceId(env, o) !== null,
        })),
      });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-payments/checkout/subscription",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(createSubscriptionCheckoutBodySchema, req.body ?? {});

      const plan = getSubscriptionPlan(body.plan);
      if (!plan) throw new HttpError(400, `unknown plan: ${body.plan}`);
      const priceId = resolvePriceId(env, plan);
      if (!priceId) {
        throw new HttpError(
          503,
          `Stripe price not configured for plan ${plan.key} (set ${plan.priceIdEnvVar})`,
        );
      }

      const customerId = await ensureStripeCustomerId(deps.db, deps.stripe, {
        companyId,
        email: body.customerEmail,
      });
      const session = await deps.stripe.createCheckoutSession({
        mode: "subscription",
        customerId,
        priceId,
        quantity: 1,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        metadata: {
          "companydev.kind": "subscription",
          "companydev.plan": plan.key,
          "companydev.companyId": companyId,
        },
      });
      res.status(201).json({ checkout: session });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-payments/checkout/top-up",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(createTopUpCheckoutBodySchema, req.body ?? {});

      const opt = getTopUpOption(body.credits);
      if (!opt) throw new HttpError(400, `unknown top-up: ${body.credits} credits`);
      const priceId = resolvePriceId(env, opt);
      if (!priceId) {
        throw new HttpError(
          503,
          `Stripe price not configured for top-up ${opt.credits} (set ${opt.priceIdEnvVar})`,
        );
      }

      const customerId = await ensureStripeCustomerId(deps.db, deps.stripe, {
        companyId,
        email: body.customerEmail,
      });
      const session = await deps.stripe.createCheckoutSession({
        mode: "payment",
        customerId,
        priceId,
        quantity: 1,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
        metadata: {
          "companydev.kind": "top_up",
          "companydev.credits": String(opt.credits),
          "companydev.companyId": companyId,
        },
      });
      res.status(201).json({ checkout: session });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-payments/portal",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(createPortalBodySchema, req.body ?? {});
      const customerId = await ensureStripeCustomerId(deps.db, deps.stripe, { companyId });
      const portal = await deps.stripe.createBillingPortalSession({
        customerId,
        returnUrl: body.returnUrl,
      });
      res.json({ portal });
    }),
  );

  // ---------------------------------------------------------------------
  // B-08 — Settings tabs
  // ---------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-payments/billing/summary",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const [subscription, balanceCents] = await Promise.all([
        getSubscriptionForCompany(deps.db, companyId),
        getCompanyBalanceCents(deps.db, companyId),
      ]);
      const plan = subscription
        ? getSubscriptionPlan(subscription.plan) ?? null
        : null;
      res.json({
        billing: {
          plan: subscription
            ? {
                key: subscription.plan,
                displayName: plan?.displayName ?? subscription.plan,
                monthlyPriceCents: plan?.monthlyPriceCents ?? null,
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd
                  ? subscription.currentPeriodEnd.toISOString()
                  : null,
                cancelAt: subscription.cancelAt
                  ? subscription.cancelAt.toISOString()
                  : null,
                canceledAt: subscription.canceledAt
                  ? subscription.canceledAt.toISOString()
                  : null,
              }
            : null,
          balanceCents,
        },
      });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-payments/usage/summary",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const window = currentMonthWindow(now());
      const [balanceCents, breakdown] = await Promise.all([
        getCompanyBalanceCents(deps.db, companyId),
        listUsageBreakdownByAgent(deps.db, { companyId, ...window }),
      ]);
      const totalUsageCents = breakdown.reduce((acc, r) => acc + r.usageCents, 0);
      res.json({
        usage: {
          balanceCents,
          window: {
            start: window.windowStart.toISOString(),
            end: window.windowEnd.toISOString(),
          },
          totalUsageCents,
          byAgent: breakdown,
        },
      });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-payments/usage/transactions",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const query = parseQuery(transactionHistoryQuerySchema, req.query);
      const rows = await listTransactionHistory(deps.db, {
        companyId,
        limit: query.limit,
        before: query.before ? new Date(query.before) : undefined,
      });
      res.json({ transactions: rows.map(toTransactionDto) });
    }),
  );

  router.get(
    "/companies/:companyId/plugin-payments/server/info",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const info = await serverInfo.getServerInfo({ companyId });
      res.json({ server: info });
    }),
  );

  // ---------------------------------------------------------------------
  // Webhook endpoint — public (no host authz). Security relies on Stripe's
  // signature verification against `webhookSecret`.
  // ---------------------------------------------------------------------
  router.post(
    "/webhooks/stripe",
    asyncHandler(async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        throw new HttpError(400, "missing Stripe-Signature header");
      }
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        throw new HttpError(
          500,
          "server did not capture rawBody — app.ts must register express.json({ verify })",
        );
      }
      let event;
      try {
        event = deps.stripe.verifyWebhookSignature({
          rawBody,
          signature,
          secret: deps.webhookSecret,
        });
      } catch (err) {
        if (err instanceof StripeSignatureError) {
          throw new HttpError(400, err.message);
        }
        throw err;
      }
      const outcome = await applyWebhookEvent(deps.db, event);
      res.json({ received: true, handled: outcome.handled, note: outcome.note });
    }),
  );

  router.use((err: unknown, _req: Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  });

  return router;
}

function toSubscriptionDto(row: {
  id: string;
  companyId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAt: Date | null;
  canceledAt: Date | null;
}) {
  return {
    id: row.id,
    companyId: row.companyId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    plan: row.plan,
    status: row.status,
    currentPeriodStart: row.currentPeriodStart ? row.currentPeriodStart.toISOString() : null,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    cancelAt: row.cancelAt ? row.cancelAt.toISOString() : null,
    canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
  };
}

function toTransactionDto(row: CreditLedgerEntry) {
  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    runId: row.runId,
    entryType: row.entryType,
    amountCents: row.amountCents,
    description: row.description,
    externalRef: row.externalRef,
    createdAt: row.createdAt.toISOString(),
  };
}

type AsyncHandler = (
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) => Promise<unknown>;

function asyncHandler(fn: AsyncHandler) {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
