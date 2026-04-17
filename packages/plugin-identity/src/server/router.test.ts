import { afterEach, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import type { Db } from "@paperclipai/db";
import { MockBankProvider } from "../bank/mock.js";
import { MockEmailProvider } from "../email/mock.js";
import {
  createPluginIdentityRouter,
  type PluginIdentityActorInfo,
} from "./router.js";

const cleanups: Array<() => Promise<void> | void> = [];

interface AppCtx {
  app: express.Express;
  bankProvider: MockBankProvider;
  setActor: (actor: PluginIdentityActorInfo | null) => void;
  setDenyCompanyId: (companyId: string | null) => void;
}

function buildApp(): AppCtx {
  const bankProvider = new MockBankProvider();
  // Cards routes don't touch the DB or EmailProvider, so a stub Db is
  // safe here. The B-15 domain routes have their own embedded-postgres
  // suite in `domains.router.test.ts`.
  const stubDb = {} as unknown as Db;
  const emailProvider = new MockEmailProvider();
  let actor: PluginIdentityActorInfo | null = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  let denyCompanyId: string | null = null;

  const app = express();
  app.use(express.json());
  app.use(
    createPluginIdentityRouter({
      db: stubDb,
      bankProvider,
      emailProvider,
      authorizeCompanyAccess: (_req: Request, companyId: string) => {
        if (denyCompanyId && denyCompanyId === companyId) {
          throw Object.assign(new Error("forbidden"), { status: 403 });
        }
      },
      resolveActorInfo: () => {
        if (!actor) throw Object.assign(new Error("unauth"), { status: 401 });
        return actor;
      },
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ error: err.message ?? "internal" });
  });

  return {
    app,
    bankProvider,
    setActor: (next) => {
      actor = next;
    },
    setDenyCompanyId: (id) => {
      denyCompanyId = id;
    },
  };
}

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";
const AGENT_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const AGENT_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describe("plugin-identity HTTP router (B-13) · cards", () => {
  it("POST → GET round-trip: creating a card returns it via list with a masked PAN", async () => {
    const ctx = buildApp();
    const created = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 250 })
      .expect(201);

    expect(created.body.card).toMatchObject({
      cardId: expect.any(String),
      ownerAgentId: AGENT_1,
      spendingLimitUsd: 250,
      spentUsd: 0,
      status: "active",
      pan: expect.any(String),
      last4: expect.stringMatching(/^\d{4}$/),
    });
    expect(created.body.card.pan).toContain("*");

    const listed = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);

    expect(listed.body.cards).toHaveLength(1);
    expect(listed.body.cards[0].cardId).toBe(created.body.card.cardId);
    expect(listed.body.cards[0].pan).toBe(created.body.card.pan);
  });

  it("GET returns [] for an agent that has no cards yet (auto-provisions the company account)", async () => {
    const ctx = buildApp();
    const res = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);
    expect(res.body).toEqual({ cards: [] });
  });

  it("filters cards by ownerAgentId — issuing a card for AGENT_1 does not appear in AGENT_2's list", async () => {
    const ctx = buildApp();
    await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 100 })
      .expect(201);

    const agent1 = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);
    const agent2 = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_2}/cards`)
      .expect(200);

    expect(agent1.body.cards).toHaveLength(1);
    expect(agent2.body.cards).toEqual([]);
  });

  it("scopes accounts per-company — a card in COMPANY_A is never visible in COMPANY_B", async () => {
    const ctx = buildApp();
    await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 100 })
      .expect(201);

    const inB = await request(ctx.app)
      .get(`/companies/${COMPANY_B}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);
    expect(inB.body.cards).toEqual([]);
  });

  it("POST is idempotent on retry with the same idempotency key", async () => {
    const ctx = buildApp();
    const body = { spendingLimitUsd: 500, idempotencyKey: "abc-123" };
    const first = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send(body)
      .expect(201);
    const second = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send(body)
      .expect(201);

    expect(second.body.card.cardId).toBe(first.body.card.cardId);

    const listed = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);
    expect(listed.body.cards).toHaveLength(1);
  });

  it("POST forwards merchantCategoryFilters", async () => {
    const ctx = buildApp();
    const created = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({
        spendingLimitUsd: 100,
        merchantCategoryFilters: ["software", "ads"],
      })
      .expect(201);
    expect(created.body.card.merchantCategoryFilters).toEqual(["software", "ads"]);
  });

  it("POST validates body — non-positive spending limit is rejected", async () => {
    const ctx = buildApp();
    const res = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 0 })
      .expect(400);
    expect(res.body.error).toMatch(/spendingLimitUsd/);
  });

  it("POST validates path params — non-uuid agentId is rejected", async () => {
    const ctx = buildApp();
    const res = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/not-a-uuid/cards`)
      .send({ spendingLimitUsd: 1 })
      .expect(400);
    expect(res.body.error).toMatch(/agentId/);
  });

  it("POST surfaces the host's authz failure as 403", async () => {
    const ctx = buildApp();
    ctx.setDenyCompanyId(COMPANY_A);
    await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 50 })
      .expect(403);
  });

  it("freezeCard endpoint flips the card's status to frozen", async () => {
    const ctx = buildApp();
    const created = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 50 })
      .expect(201);
    const cardId = created.body.card.cardId;

    const frozen = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards/${cardId}/freeze`)
      .expect(200);
    expect(frozen.body.card.status).toBe("frozen");

    const listed = await request(ctx.app)
      .get(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .expect(200);
    expect(listed.body.cards[0].status).toBe("frozen");
  });

  it("freezeCard returns 404 when the card belongs to a different agent", async () => {
    const ctx = buildApp();
    const created = await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards`)
      .send({ spendingLimitUsd: 50 })
      .expect(201);

    await request(ctx.app)
      .post(`/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_2}/cards/${created.body.card.cardId}/freeze`)
      .expect(404);
  });

  it("freezeCard returns 404 for an unknown cardId", async () => {
    const ctx = buildApp();
    await request(ctx.app)
      .post(
        `/companies/${COMPANY_A}/plugin-identity/agents/${AGENT_1}/cards/card-does-not-exist/freeze`,
      )
      .expect(404);
  });
});
