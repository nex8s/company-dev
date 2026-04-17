import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  heartbeatRuns,
  issueComments,
  issues,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  VIA_CHECK_IN_PREFIX,
  createCheckInPoster,
  formatCheckInBody,
  resolveIssueIdForRunByExecution,
  type RunLifecycleEvent,
} from "./check-in-poster.js";
import { seedCompanyAgents } from "../agents/factory.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping check-in poster tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-checkin-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return company;
}

async function freshIssue(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
  title = "Adapter spike",
) {
  const [issue] = await db
    .insert(issues)
    .values({ companyId, title, status: "todo" })
    .returning();
  return issue;
}

async function freshRunForIssue(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  companyId: string,
  agentId: string,
  issueId: string,
) {
  const [run] = await db
    .insert(heartbeatRuns)
    .values({
      companyId,
      agentId,
      status: "running",
      invocationSource: "automation",
      triggerDetail: "system",
    })
    .returning();
  await db.update(issues).set({ executionRunId: run!.id }).where(eq(issues.id, issueId));
  return run!;
}

describe("formatCheckInBody (A-06)", () => {
  it("prefixes every body with `via check-in:`", () => {
    const cases: RunLifecycleEvent[] = [
      { runId: "r", companyId: "c", kind: "error_recovery" },
      { runId: "r", companyId: "c", kind: "restart" },
      { runId: "r", companyId: "c", kind: "retry" },
    ];
    for (const event of cases) {
      expect(formatCheckInBody(event).startsWith(VIA_CHECK_IN_PREFIX)).toBe(true);
    }
  });

  it("includes errorCode and detail for error_recovery", () => {
    const body = formatCheckInBody({
      runId: "r",
      companyId: "c",
      kind: "error_recovery",
      errorCode: "ADAPTER_TIMEOUT",
      detail: "codex-local timed out after 30s",
    });
    expect(body).toContain("ADAPTER_TIMEOUT");
    expect(body).toContain("codex-local timed out after 30s");
  });

  it("trims whitespace-only detail rather than emitting an empty separator", () => {
    expect(formatCheckInBody({ runId: "r", companyId: "c", kind: "restart", detail: "   " })).toBe(
      `${VIA_CHECK_IN_PREFIX} run restarted`,
    );
  });
});

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("check-in poster (A-06)", () => {
  it(
    "posts a `via check-in` comment to the company chat issue when an adapter error_recovery event fires",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "ERR");
      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });
      const issue = await freshIssue(db, company.id);
      const run = await freshRunForIssue(db, company.id, ceo.id, issue.id);

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      const result = await poster.postCheckIn({
        runId: run.id,
        companyId: company.id,
        kind: "error_recovery",
        errorCode: "ADAPTER_TIMEOUT",
        detail: "codex-local timed out after 30s",
      });

      expect(result.commentId).toBeTruthy();
      expect(result.skipped).toBeUndefined();

      const stored = await db
        .select()
        .from(issueComments)
        .where(and(eq(issueComments.issueId, issue.id), eq(issueComments.createdByRunId, run.id)));
      expect(stored).toHaveLength(1);
      expect(stored[0]!.body.startsWith(VIA_CHECK_IN_PREFIX)).toBe(true);
      expect(stored[0]!.body).toContain("ADAPTER_TIMEOUT");
      expect(stored[0]!.authorAgentId).toBeNull();
      expect(stored[0]!.authorUserId).toBeNull();
    },
    20_000,
  );

  it(
    "posts on restart and retry kinds in addition to error_recovery",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "RST");
      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });
      const issue = await freshIssue(db, company.id);
      const run = await freshRunForIssue(db, company.id, ceo.id, issue.id);

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      await poster.postCheckIn({
        runId: run.id,
        companyId: company.id,
        kind: "restart",
        detail: "process group lost; restarted",
      });
      await poster.postCheckIn({
        runId: run.id,
        companyId: company.id,
        kind: "retry",
        detail: "attempt 2",
      });

      const stored = await db
        .select()
        .from(issueComments)
        .where(eq(issueComments.issueId, issue.id))
        .orderBy(issueComments.createdAt);
      expect(stored).toHaveLength(2);
      expect(stored[0]!.body).toContain("restarted");
      expect(stored[1]!.body).toContain("retried");
    },
    20_000,
  );

  it(
    "skips with `no-issue` when the run is not bound to any issue",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "ORF");
      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });

      const [orphanRun] = await db
        .insert(heartbeatRuns)
        .values({
          companyId: company.id,
          agentId: ceo.id,
          status: "running",
          invocationSource: "on_demand",
        })
        .returning();

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      const result = await poster.postCheckIn({
        runId: orphanRun!.id,
        companyId: company.id,
        kind: "error_recovery",
      });

      expect(result.commentId).toBeNull();
      expect(result.skipped).toBe("no-issue");

      const stored = await db.select().from(issueComments);
      expect(stored).toHaveLength(0);
    },
    20_000,
  );

  it(
    "is idempotent: re-emitting the same lifecycle event posts only one comment",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "IDM");
      const { ceo } = await seedCompanyAgents(db, { companyId: company.id });
      const issue = await freshIssue(db, company.id);
      const run = await freshRunForIssue(db, company.id, ceo.id, issue.id);

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      const event: RunLifecycleEvent = {
        runId: run.id,
        companyId: company.id,
        kind: "error_recovery",
        errorCode: "ADAPTER_TIMEOUT",
      };

      const first = await poster.postCheckIn(event);
      const second = await poster.postCheckIn(event);

      expect(first.commentId).toBeTruthy();
      expect(first.skipped).toBeUndefined();
      expect(second.commentId).toBe(first.commentId);
      expect(second.skipped).toBe("duplicate");

      const stored = await db
        .select()
        .from(issueComments)
        .where(eq(issueComments.createdByRunId, run.id));
      expect(stored).toHaveLength(1);
    },
    20_000,
  );

  it(
    "scopes resolution by companyId — does not post into another company's issue",
    async () => {
      const db = await freshDatabase();
      const companyA = await freshCompany(db, "CAA");
      const companyB = await freshCompany(db, "CBB");
      const { ceo: ceoA } = await seedCompanyAgents(db, { companyId: companyA.id });
      const issueA = await freshIssue(db, companyA.id);
      const runA = await freshRunForIssue(db, companyA.id, ceoA.id, issueA.id);

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      // Look up runA but pretend it belongs to companyB → must not resolve.
      const result = await poster.postCheckIn({
        runId: runA.id,
        companyId: companyB.id,
        kind: "error_recovery",
      });
      expect(result.skipped).toBe("no-issue");

      const stored = await db.select().from(issueComments);
      expect(stored).toHaveLength(0);
    },
    20_000,
  );
});
