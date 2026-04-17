import { Router, type Request } from "express";
import type { z, ZodError } from "zod";
import type { Db } from "@paperclipai/db";
import type { BankProvider, VirtualCard } from "../bank/index.js";
import type { EmailProvider } from "../email/index.js";
import {
  createDomain,
  deleteDomain,
  getDomain,
  listDomains,
  setDefaultDomain,
  type DomainRow,
} from "../domains/index.js";
import {
  cardIdParamSchema,
  companyAgentParamSchema,
  companyIdParamSchema,
  createDomainBodySchema,
  domainIdParamSchema,
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
  /** Drizzle handle. Required for B-15 domain persistence. */
  readonly db: Db;
  /** Backing BankProvider — Mock in dev/test, real (Mercury/Column/Stripe) in prod. */
  readonly bankProvider: BankProvider;
  /** Backing EmailProvider — Mock in dev/test, real (Resend/Postmark) in prod. */
  readonly emailProvider: EmailProvider;
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

  // ---------------------------------------------------------------------
  // Domains (B-15)
  //   GET    /companies/:companyId/plugin-identity/domains
  //   POST   /companies/:companyId/plugin-identity/domains
  //   POST   /companies/:companyId/plugin-identity/domains/:domainId/default
  //   DELETE /companies/:companyId/plugin-identity/domains/:domainId
  // ---------------------------------------------------------------------

  router.get(
    "/companies/:companyId/plugin-identity/domains",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const rows = await listDomains(deps.db, companyId);
      res.json({ domains: rows.map(toDomainDto) });
    }),
  );

  router.post(
    "/companies/:companyId/plugin-identity/domains",
    asyncHandler(async (req, res) => {
      const { companyId } = parseParams(companyIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const body = parseBody(createDomainBodySchema, req.body ?? {});

      try {
        const row = await createDomain(deps.db, deps.emailProvider, {
          companyId,
          domain: body.domain,
        });
        res.status(201).json({ domain: toDomainDto(row) });
      } catch (err) {
        if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
          throw new HttpError(409, `domain already connected: ${body.domain}`);
        }
        throw err;
      }
    }),
  );

  router.post(
    "/companies/:companyId/plugin-identity/domains/:domainId/default",
    asyncHandler(async (req, res) => {
      const { companyId, domainId } = parseParams(domainIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      const updated = await setDefaultDomain(deps.db, companyId, domainId);
      if (!updated) throw new HttpError(404, `domain not found: ${domainId}`);
      res.json({ domain: toDomainDto(updated) });
    }),
  );

  router.delete(
    "/companies/:companyId/plugin-identity/domains/:domainId",
    asyncHandler(async (req, res) => {
      const { companyId, domainId } = parseParams(domainIdParamSchema, req.params);
      deps.authorizeCompanyAccess(req, companyId);
      // Surface a 404 *before* deleting so the client can tell missing-vs-no-op.
      const existing = await getDomain(deps.db, companyId, domainId);
      if (!existing) throw new HttpError(404, `domain not found: ${domainId}`);
      await deleteDomain(deps.db, companyId, domainId);
      res.status(204).send();
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

function toDomainDto(row: DomainRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    domain: row.domain,
    isDefault: row.isDefault,
    status: row.status,
    dnsRecords: row.dnsRecords,
    registeredAt: row.registeredAt.toISOString(),
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
