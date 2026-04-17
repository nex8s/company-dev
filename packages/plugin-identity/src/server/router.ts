import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { BankProvider, VirtualCard } from "../bank/index.js";
import {
  cardIdParamSchema,
  companyAgentParamSchema,
  issueCardBodySchema,
} from "./schemas.js";

/**
 * Per-request actor metadata. Mirrors the shape used by plugin-company so the
 * host can pass the same `getActorInfo`-derived value into both plugins.
 */
export interface PluginIdentityActorInfo {
  readonly actorType: "agent" | "user";
  readonly actorId: string;
  readonly agentId: string | null;
  readonly runId: string | null;
}

export interface PluginIdentityRouterDeps {
  /** Backing BankProvider — Mock in dev/test, real (Mercury/Column/Stripe) in prod. */
  readonly bankProvider: BankProvider;
  /**
   * Authorize the request for the given companyId. Implementations should
   * throw an HTTP-shaped error (e.g. via `assertCompanyAccess`) when access
   * is denied; the router does not catch — it lets the host's error handler
   * translate to 401/403.
   */
  readonly authorizeCompanyAccess: (req: Request, companyId: string) => void;
  /** Resolve the calling actor (agent vs user) from the request. */
  readonly resolveActorInfo: (req: Request) => PluginIdentityActorInfo;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function parseParams<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }
  return parsed.data;
}

function parseBody<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }
  return parsed.data;
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`)
    .join("; ");
}

/**
 * Synthesize a stable idempotency key for the company's operating account so
 * `openAccount` returns the same account on every call. The BankProvider's
 * idempotency contract guarantees same-key → same-id (B-10 contract test).
 */
function operatingAccountIdemKey(companyId: string): string {
  return `plugin-identity:operating:${companyId}`;
}

/**
 * Build the plugin-identity HTTP router. All paths are absolute under the
 * server's `/api` mount: e.g.
 *   `GET  /api/companies/:companyId/plugin-identity/agents/:agentId/cards`
 *   `POST /api/companies/:companyId/plugin-identity/agents/:agentId/cards`
 *   `POST /api/companies/:companyId/plugin-identity/agents/:agentId/cards/:cardId/freeze`
 *
 * The router auto-provisions one operating account per company on first card
 * issuance using a deterministic idempotency key, so callers don't have to
 * create the account separately.
 */
export function createPluginIdentityRouter(deps: PluginIdentityRouterDeps): Router {
  const router = Router();

  router.get(
    "/companies/:companyId/plugin-identity/agents/:agentId/cards",
    asyncHandler(async (req, res) => {
      const { companyId, agentId } = parseParams(companyAgentParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const account = await ensureOperatingAccount(deps.bankProvider, companyId);
      const all = await deps.bankProvider.listCards(account.accountId);
      const cards = all.filter((c) => c.ownerAgentId === agentId);
      res.json({ cards: cards.map(toCardDto) });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-identity/agents/:agentId/cards",
    asyncHandler(async (req, res) => {
      const { companyId, agentId } = parseParams(companyAgentParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(issueCardBodySchema, req.body ?? {});

      const account = await ensureOperatingAccount(deps.bankProvider, companyId);
      const card = await deps.bankProvider.issueVirtualCard({
        accountId: account.accountId,
        ownerAgentId: agentId,
        spendingLimitUsd: body.spendingLimitUsd,
        merchantCategoryFilters: body.merchantCategoryFilters,
        idempotencyKey: body.idempotencyKey,
      });
      res.status(201).json({ card: toCardDto(card) });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-identity/agents/:agentId/cards/:cardId/freeze",
    asyncHandler(async (req, res) => {
      const { companyId, agentId, cardId } = parseParams(cardIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);

      const account = await ensureOperatingAccount(deps.bankProvider, companyId);
      const cards = await deps.bankProvider.listCards(account.accountId);
      const target = cards.find((c) => c.cardId === cardId);
      if (!target) throw new HttpError(404, `card not found: ${cardId}`);
      if (target.ownerAgentId !== agentId) {
        throw new HttpError(404, `card not found: ${cardId}`);
      }
      await deps.bankProvider.freezeCard(cardId);
      const refreshed = (await deps.bankProvider.listCards(account.accountId)).find(
        (c) => c.cardId === cardId,
      )!;
      res.json({ card: toCardDto(refreshed) });
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

async function ensureOperatingAccount(provider: BankProvider, companyId: string) {
  return provider.openAccount({
    companyId,
    legalEntityId: `stub-entity:${companyId}`,
    accountType: "operating",
    idempotencyKey: operatingAccountIdemKey(companyId),
  });
}

function toCardDto(card: VirtualCard) {
  return {
    cardId: card.cardId,
    accountId: card.accountId,
    ownerAgentId: card.ownerAgentId,
    pan: card.pan,
    last4: card.last4,
    spendingLimitUsd: card.spendingLimitUsd,
    spentUsd: card.spentUsd,
    merchantCategoryFilters: card.merchantCategoryFilters,
    status: card.status,
    createdAt: card.createdAt.toISOString(),
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
