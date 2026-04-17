import { afterEach, describe, expect, it } from "vitest";
import {
  agents,
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  findEntryByExternalRef,
  getAgentUsageCentsInWindow,
  getCompanyBalanceCents,
  listRecentEntries,
  monthStart,
  nextMonthStart,
  recordAdjustment,
  recordRollover,
  recordTopUp,
  recordUsage,
} from "./operations.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping credit ledger tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-payments-ledger-");
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

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describe("monthStart / nextMonthStart (A-07)", () => {
  it("monthStart truncates to UTC start-of-month", () => {
    const d = new Date(Date.UTC(2026, 3, 17, 14, 32, 11, 200));
    expect(monthStart(d).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("nextMonthStart returns the first day of the following month at 00:00 UTC", () => {
    const d = new Date(Date.UTC(2026, 3, 17, 14, 32, 11, 200));
    expect(nextMonthStart(d).toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("nextMonthStart wraps year boundary correctly", () => {
    const d = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999));
    expect(nextMonthStart(d).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describeEmbeddedPostgres("credit ledger operations (A-07)", () => {
  it(
    "recordTopUp inserts a positive entry and getCompanyBalanceCents reflects it",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "TU1");

      const entry = await recordTopUp(db, {
        companyId: company.id,
        amountCents: 5_000,
        externalRef: "stripe_ch_123",
        description: "Stripe top-up: 50 USD",
      });
      expect(entry.entryType).toBe("top_up");
      expect(entry.amountCents).toBe(5_000);
      expect(entry.externalRef).toBe("stripe_ch_123");

      expect(await getCompanyBalanceCents(db, company.id)).toBe(5_000);
    },
    20_000,
  );

  it(
    "recordUsage subtracts from the company balance and records run/agent attribution",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "USE");
      const agent = await freshAgent(db, company.id, "Aurora");

      await recordTopUp(db, { companyId: company.id, amountCents: 10_000 });
      const usage = await recordUsage(db, {
        companyId: company.id,
        agentId: agent.id,
        amountCents: 750,
        description: "claude run",
      });
      expect(usage.entryType).toBe("usage");
      expect(usage.agentId).toBe(agent.id);

      expect(await getCompanyBalanceCents(db, company.id)).toBe(10_000 - 750);
    },
    20_000,
  );

  it(
    "rollover and adjustment both add to the balance",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "RAA");

      await recordTopUp(db, { companyId: company.id, amountCents: 1_000 });
      await recordRollover(db, { companyId: company.id, amountCents: 500 });
      await recordAdjustment(db, {
        companyId: company.id,
        amountCents: 300,
        description: "support goodwill",
      });

      expect(await getCompanyBalanceCents(db, company.id)).toBe(1_800);
    },
    20_000,
  );

  it(
    "balance is 0 for a fresh company with no ledger entries",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "EMP");
      expect(await getCompanyBalanceCents(db, company.id)).toBe(0);
    },
    20_000,
  );

  it(
    "balance is scoped per-company — top-ups in company A don't appear in company B",
    async () => {
      const db = await freshDatabase();
      const a = await freshCompany(db, "ISO1");
      const b = await freshCompany(db, "ISO2");
      await recordTopUp(db, { companyId: a.id, amountCents: 12_000 });
      await recordTopUp(db, { companyId: b.id, amountCents: 7_000 });
      expect(await getCompanyBalanceCents(db, a.id)).toBe(12_000);
      expect(await getCompanyBalanceCents(db, b.id)).toBe(7_000);
    },
    20_000,
  );

  it(
    "rejects zero / negative / non-integer amounts in every recorder",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "VAL");
      const agent = await freshAgent(db, company.id, "A");
      await expect(
        recordTopUp(db, { companyId: company.id, amountCents: 0 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        recordTopUp(db, { companyId: company.id, amountCents: -5 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        recordTopUp(db, { companyId: company.id, amountCents: 1.5 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        recordUsage(db, { companyId: company.id, agentId: agent.id, amountCents: 0 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        recordRollover(db, { companyId: company.id, amountCents: 0 }),
      ).rejects.toThrow(/positive integer/);
      await expect(
        recordAdjustment(db, { companyId: company.id, amountCents: 0 }),
      ).rejects.toThrow(/positive integer/);
    },
    20_000,
  );

  it(
    "getAgentUsageCentsInWindow only sums usage entries for the given agent and window",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "WIN");
      const aurora = await freshAgent(db, company.id, "Aurora");
      const blaze = await freshAgent(db, company.id, "Blaze");

      // April usage by Aurora.
      await recordUsage(db, { companyId: company.id, agentId: aurora.id, amountCents: 100 });
      await recordUsage(db, { companyId: company.id, agentId: aurora.id, amountCents: 200 });
      // April usage by Blaze.
      await recordUsage(db, { companyId: company.id, agentId: blaze.id, amountCents: 999 });

      const aprilStart = monthStart(new Date());
      const aprilEnd = nextMonthStart(new Date());
      const auroraUsage = await getAgentUsageCentsInWindow(db, {
        companyId: company.id,
        agentId: aurora.id,
        windowStart: aprilStart,
        windowEnd: aprilEnd,
      });
      expect(auroraUsage).toBe(300);

      // A future window should return 0.
      const next = nextMonthStart(new Date());
      const monthAfter = nextMonthStart(next);
      expect(
        await getAgentUsageCentsInWindow(db, {
          companyId: company.id,
          agentId: aurora.id,
          windowStart: next,
          windowEnd: monthAfter,
        }),
      ).toBe(0);
    },
    20_000,
  );

  it(
    "findEntryByExternalRef returns matching entries and ignores non-credit-types by default",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "REF");
      const agent = await freshAgent(db, company.id, "A");
      await recordTopUp(db, {
        companyId: company.id,
        amountCents: 1_000,
        externalRef: "stripe_ch_abc",
      });
      await recordUsage(db, {
        companyId: company.id,
        agentId: agent.id,
        amountCents: 50,
        description: "matches stripe_ch_abc but is usage",
      });

      const found = await findEntryByExternalRef(db, {
        companyId: company.id,
        externalRef: "stripe_ch_abc",
      });
      expect(found?.entryType).toBe("top_up");

      const missing = await findEntryByExternalRef(db, {
        companyId: company.id,
        externalRef: "stripe_ch_zzz",
      });
      expect(missing).toBeNull();
    },
    20_000,
  );

  it(
    "listRecentEntries returns entries newest-first up to the given limit",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "REC");
      for (let i = 0; i < 5; i += 1) {
        await recordTopUp(db, { companyId: company.id, amountCents: 100 + i });
      }
      const recent = await listRecentEntries(db, company.id, 3);
      expect(recent).toHaveLength(3);
      // Newest-first: the last insert (104) is first.
      expect(recent[0]!.amountCents).toBe(104);
      expect(recent[1]!.amountCents).toBe(103);
      expect(recent[2]!.amountCents).toBe(102);
    },
    20_000,
  );
});
