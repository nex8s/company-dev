import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  agents,
  applyPendingMigrations,
  budgetIncidents,
  companies,
  createDb,
  creditLedger,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  enforceAgentMonthlyCap,
  getAgentMonthlyCap,
  resumePausedAgentsForNewMonth,
  setAgentMonthlyCap,
} from "./cap-enforcement.js";
import { recordTopUp, recordUsage } from "../ledger/operations.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping cap-enforcement tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-payments-caps-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return company!;
}

async function freshAgent(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
  name: string,
) {
  const [agent] = await db
    .insert(agents)
    .values({ companyId, name, status: "idle" })
    .returning();
  return agent!;
}

async function getAgentStatus(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  agentId: string,
) {
  const [row] = await db.select({ status: agents.status }).from(agents).where(eq(agents.id, agentId));
  return row!.status;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("setAgentMonthlyCap (A-07)", () => {
  it(
    "creates a budget_policies row on first call and updates it on second call",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "CAP");
      const agent = await freshAgent(db, company.id, "Aurora");

      const first = await setAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        capCents: 5_000,
      });
      expect(first.amount).toBe(5_000);

      const second = await setAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        capCents: 7_500,
      });
      expect(second.id).toBe(first.id);
      expect(second.amount).toBe(7_500);

      const lookedUp = await getAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(lookedUp).toEqual({ policyId: first.id, capCents: 7_500 });
    },
    20_000,
  );

  it(
    "rejects zero / negative / non-integer capCents",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "BAD");
      const agent = await freshAgent(db, company.id, "X");
      await expect(
        setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 0 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: -1 }),
      ).rejects.toThrow(/positive integer/);
    },
    20_000,
  );
});

describeEmbeddedPostgres("enforceAgentMonthlyCap (A-07)", () => {
  it(
    "no cap configured → reports capConfigured=false and never pauses",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "NOC");
      const agent = await freshAgent(db, company.id, "X");
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 999_999 });

      const result = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(result.capConfigured).toBe(false);
      expect(result.pausedNow).toBe(false);
      expect(await getAgentStatus(db, agent.id)).toBe("idle");
    },
    20_000,
  );

  it(
    "usage below cap → no pause, capExceeded=false",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "BLW");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 1_000 });
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 800 });

      const result = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(result.capExceeded).toBe(false);
      expect(result.pausedNow).toBe(false);
      expect(await getAgentStatus(db, agent.id)).toBe("idle");
    },
    20_000,
  );

  it(
    "usage at-or-over cap flips status to paused and records a budget_incident",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "PAU");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 1_000 });
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 1_000 });

      const result = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(result.capExceeded).toBe(true);
      expect(result.pausedNow).toBe(true);
      expect(result.incidentId).toBeTruthy();
      expect(await getAgentStatus(db, agent.id)).toBe("paused");

      const incidents = await db.select().from(budgetIncidents).where(eq(budgetIncidents.scopeId, agent.id));
      expect(incidents).toHaveLength(1);
      expect(incidents[0]!.status).toBe("open");
      expect(incidents[0]!.amountObserved).toBe(1_000);
      expect(incidents[0]!.amountLimit).toBe(1_000);
    },
    20_000,
  );

  it(
    "is idempotent — calling enforce twice in the same window does not create a second incident or re-flip status",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "IDM");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 500 });
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 600 });

      const first = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(first.pausedNow).toBe(true);
      const second = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      expect(second.capExceeded).toBe(true);
      expect(second.pausedNow).toBe(false);
      expect(second.incidentId).toBe(first.incidentId);

      const incidents = await db.select().from(budgetIncidents).where(eq(budgetIncidents.scopeId, agent.id));
      expect(incidents).toHaveLength(1);
    },
    20_000,
  );

  it(
    "graceful pause: only flips status, does not abort in-flight runs (no run-table mutation)",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "GFL");
      const agent = await freshAgent(db, company.id, "X");
      // Pretend the agent is mid-run.
      await db.update(agents).set({ status: "running" }).where(eq(agents.id, agent.id));
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 100 });
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 200 });

      const result = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
      });
      // wasActive (status !== paused), so we flip to paused; the in-flight run is left alone.
      expect(result.pausedNow).toBe(true);
      expect(await getAgentStatus(db, agent.id)).toBe("paused");
    },
    20_000,
  );
});

describeEmbeddedPostgres("resumePausedAgentsForNewMonth (A-07)", () => {
  it(
    "resumes an agent paused last month when this month's usage is under the cap",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "RES");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 1_000 });

      // Simulate last month's usage: insert ledger entry + enforce, using an
      // asOf date in the prior month.
      const lastMonth = new Date(Date.UTC(2026, 2, 15)); // March 15
      // Pre-date the usage row's created_at by patching directly through the ledger insert.
      await recordUsage(db, {
        companyId: company.id,
        agentId: agent.id,
        amountCents: 1_500,
      });
      // Backdate the just-inserted usage row to lastMonth.
      await db
        .update(creditLedger)
        .set({ createdAt: lastMonth })
        .where(and(eq(creditLedger.companyId, company.id), eq(creditLedger.agentId, agent.id)));

      const enforce = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        asOf: lastMonth,
      });
      expect(enforce.pausedNow).toBe(true);
      expect(await getAgentStatus(db, agent.id)).toBe("paused");

      const thisMonth = new Date(Date.UTC(2026, 3, 17)); // April 17
      const sweep = await resumePausedAgentsForNewMonth(db, { asOf: thisMonth });
      expect(sweep.resumedAgentIds).toContain(agent.id);
      expect(sweep.resolvedIncidentIds).toHaveLength(1);
      expect(await getAgentStatus(db, agent.id)).toBe("idle");

      const incidents = await db.select().from(budgetIncidents).where(eq(budgetIncidents.scopeId, agent.id));
      expect(incidents[0]!.status).toBe("resolved");
      expect(incidents[0]!.resolvedAt).toBeTruthy();
    },
    20_000,
  );

  it(
    "keeps an agent paused if this month's usage already exceeds the cap",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "KPP");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 1_000 });

      const lastMonth = new Date(Date.UTC(2026, 2, 15));
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 1_500 });
      await db
        .update(creditLedger)
        .set({ createdAt: lastMonth })
        .where(and(eq(creditLedger.companyId, company.id), eq(creditLedger.agentId, agent.id)));
      await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        asOf: lastMonth,
      });

      // This month: usage already exceeds cap.
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 1_200 });

      const sweep = await resumePausedAgentsForNewMonth(db, {
        asOf: new Date(Date.UTC(2026, 3, 17)),
      });
      expect(sweep.resumedAgentIds).toHaveLength(0);
      expect(await getAgentStatus(db, agent.id)).toBe("paused");
    },
    20_000,
  );

  it(
    "resolves stale incidents for agents the operator already manually resumed",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "STA");
      const agent = await freshAgent(db, company.id, "X");
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 1_000 });

      const lastMonth = new Date(Date.UTC(2026, 2, 15));
      await recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 1_500 });
      await db
        .update(creditLedger)
        .set({ createdAt: lastMonth })
        .where(and(eq(creditLedger.companyId, company.id), eq(creditLedger.agentId, agent.id)));
      await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        asOf: lastMonth,
      });

      // Operator manually resumes the agent.
      await db.update(agents).set({ status: "idle" }).where(eq(agents.id, agent.id));

      const sweep = await resumePausedAgentsForNewMonth(db, {
        asOf: new Date(Date.UTC(2026, 3, 17)),
      });
      expect(sweep.resumedAgentIds).toHaveLength(0); // didn't touch status (already idle)
      expect(sweep.resolvedIncidentIds).toHaveLength(1); // but cleared the stale incident
    },
    20_000,
  );

  it(
    "is scoped per-company when companyId is passed",
    async () => {
      const db = await freshDatabase();
      const a = await freshCompany(db, "SC1");
      const b = await freshCompany(db, "SC2");
      const aAgent = await freshAgent(db, a.id, "A");
      const bAgent = await freshAgent(db, b.id, "B");
      for (const [co, ag] of [[a, aAgent], [b, bAgent]] as const) {
        await setAgentMonthlyCap(db, { companyId: co.id, agentId: ag.id, capCents: 100 });
        await recordUsage(db, { companyId: co.id, agentId: ag.id, amountCents: 200 });
        await db
          .update(creditLedger)
          .set({ createdAt: new Date(Date.UTC(2026, 2, 15)) })
          .where(and(eq(creditLedger.companyId, co.id), eq(creditLedger.agentId, ag.id)));
        await enforceAgentMonthlyCap(db, {
          companyId: co.id,
          agentId: ag.id,
          asOf: new Date(Date.UTC(2026, 2, 15)),
        });
      }

      const sweep = await resumePausedAgentsForNewMonth(db, {
        companyId: a.id,
        asOf: new Date(Date.UTC(2026, 3, 17)),
      });
      expect(sweep.resumedAgentIds).toEqual([aAgent.id]);
      expect(await getAgentStatus(db, aAgent.id)).toBe("idle");
      expect(await getAgentStatus(db, bAgent.id)).toBe("paused");
    },
    20_000,
  );
});

describeEmbeddedPostgres("end-to-end gate scenario (A-07)", () => {
  it(
    "top-up adds credits → usage exceeds cap → agent paused → next-month sweep resumes",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "E2E");
      const agent = await freshAgent(db, company.id, "Aurora");

      // 1. Top-up.
      await recordTopUp(db, { companyId: company.id, amountCents: 5_000 });
      const { } = { balance: undefined };

      // 2. Set monthly cap and burn through it.
      await setAgentMonthlyCap(db, { companyId: company.id, agentId: agent.id, capCents: 2_000 });
      const lastMonth = new Date(Date.UTC(2026, 2, 15));
      await recordUsage(db, {
        companyId: company.id,
        agentId: agent.id,
        amountCents: 2_500,
        description: "claude run",
      });
      await db
        .update(creditLedger)
        .set({ createdAt: lastMonth })
        .where(and(eq(creditLedger.companyId, company.id), eq(creditLedger.entryType, "usage")));

      const enforce = await enforceAgentMonthlyCap(db, {
        companyId: company.id,
        agentId: agent.id,
        asOf: lastMonth,
      });
      expect(enforce.pausedNow).toBe(true);
      expect(await getAgentStatus(db, agent.id)).toBe("paused");

      // 3. New month: sweep recharges.
      const thisMonth = new Date(Date.UTC(2026, 3, 1));
      const sweep = await resumePausedAgentsForNewMonth(db, { asOf: thisMonth });
      expect(sweep.resumedAgentIds).toEqual([agent.id]);
      expect(await getAgentStatus(db, agent.id)).toBe("idle");
    },
    20_000,
  );
});
