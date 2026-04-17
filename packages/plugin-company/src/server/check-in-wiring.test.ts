import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
  categorizeLiveEvent,
  installCheckInPosterAllCompanies,
  installCheckInPosterForCompany,
  type AllCompaniesLiveEventSubscribe,
  type HeartbeatLiveEvent,
  type LiveEventSubscribe,
} from "./check-in-wiring.js";
import {
  VIA_CHECK_IN_PREFIX,
  createCheckInPoster,
  resolveIssueIdForRunByExecution,
} from "../heartbeat/check-in-poster.js";
import { seedCompanyAgents } from "../agents/factory.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping check-in wiring tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-wiring-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

/**
 * Poll for an exact comment count for a given run. The poster fires from a
 * detached `void Promise...` chain, so callers can't await the post directly;
 * polling is more robust than a fixed `setTimeout` under loaded CI parallelism.
 */
async function waitForCommentCount(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  runId: string,
  expected: number,
  timeoutMs = 5_000,
): Promise<typeof issueComments.$inferSelect[]> {
  const start = Date.now();
  let last: typeof issueComments.$inferSelect[] = [];
  while (Date.now() - start < timeoutMs) {
    last = await db
      .select()
      .from(issueComments)
      .where(eq(issueComments.createdByRunId, runId));
    if (last.length >= expected) return last;
    await new Promise((r) => setTimeout(r, 25));
  }
  return last;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describe("categorizeLiveEvent (A-06.5)", () => {
  it("returns null for non-heartbeat events", () => {
    expect(
      categorizeLiveEvent({ companyId: "c", type: "agent.status", payload: { runId: "r" } }),
    ).toBeNull();
  });

  it("returns null when the heartbeat event lacks a runId", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { eventType: "lifecycle", message: "run recovered from error" },
      }),
    ).toBeNull();
  });

  it("returns null for non-lifecycle eventTypes", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { runId: "r", eventType: "log", message: "stdout chunk" },
      }),
    ).toBeNull();
  });

  it("classifies a 'recovered' lifecycle message as error_recovery", () => {
    const out = categorizeLiveEvent({
      companyId: "c",
      type: "heartbeat.run.event",
      payload: {
        runId: "r-1",
        eventType: "lifecycle",
        message: "Adapter recovered after retry",
        errorCode: "ADAPTER_TIMEOUT",
      },
    });
    expect(out?.kind).toBe("error_recovery");
    expect(out?.runId).toBe("r-1");
    expect(out?.errorCode).toBe("ADAPTER_TIMEOUT");
  });

  it("classifies the detached-process clear message as error_recovery", () => {
    const out = categorizeLiveEvent({
      companyId: "c",
      type: "heartbeat.run.event",
      payload: {
        runId: "r-1",
        eventType: "lifecycle",
        message: "Detached child process reported activity; cleared detached warning",
      },
    });
    expect(out?.kind).toBe("error_recovery");
  });

  it("classifies 'restarted' / 'process_lost' as restart", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { runId: "r", eventType: "lifecycle", message: "Run restarted by supervisor" },
      })?.kind,
    ).toBe("restart");
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { runId: "r", eventType: "lifecycle", message: "Process lost; queued retry" },
      })?.kind,
    ).toBe("restart");
  });

  it("classifies 'retry' / 'retried' as retry", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { runId: "r", eventType: "lifecycle", message: "queued one follow-up retry wake" },
      })?.kind,
    ).toBe("retry");
  });

  it("honours the structured `eventType: 'checkin'` payload shape", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: {
          runId: "r",
          eventType: "checkin",
          kind: "retry",
          detail: "attempt 2",
        },
      }),
    ).toEqual({ runId: "r", kind: "retry", detail: "attempt 2", errorCode: null });
  });

  it("rejects an unknown structured kind", () => {
    expect(
      categorizeLiveEvent({
        companyId: "c",
        type: "heartbeat.run.event",
        payload: { runId: "r", eventType: "checkin", kind: "explosion" },
      }),
    ).toBeNull();
  });
});

describeEmbeddedPostgres("installCheckInPosterForCompany (A-06.5)", () => {
  it(
    "posts a `via check-in` comment when a heartbeat lifecycle live-event arrives",
    async () => {
      const db = await freshDatabase();
      const [company] = await db
        .insert(companies)
        .values({ name: "Test Co", issuePrefix: "WR1" })
        .returning();
      const { ceo } = await seedCompanyAgents(db, { companyId: company!.id });
      const [issue] = await db
        .insert(issues)
        .values({ companyId: company!.id, title: "T", status: "todo" })
        .returning();
      const [run] = await db
        .insert(heartbeatRuns)
        .values({ companyId: company!.id, agentId: ceo.id, status: "running" })
        .returning();
      await db.update(issues).set({ executionRunId: run!.id }).where(eq(issues.id, issue!.id));

      // Tiny in-memory live-events emitter shaped like Paperclip's API.
      const listeners = new Map<string, Array<(e: HeartbeatLiveEvent) => void>>();
      const subscribe: LiveEventSubscribe = (companyId, listener) => {
        const arr = listeners.get(companyId) ?? [];
        arr.push(listener);
        listeners.set(companyId, arr);
        return () => {
          const next = (listeners.get(companyId) ?? []).filter((fn) => fn !== listener);
          listeners.set(companyId, next);
        };
      };
      function publish(event: HeartbeatLiveEvent) {
        for (const fn of listeners.get(event.companyId) ?? []) fn(event);
      }

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      const installation = installCheckInPosterForCompany(company!.id, { subscribe, poster });

      publish({
        companyId: company!.id,
        type: "heartbeat.run.event",
        payload: {
          runId: run!.id,
          eventType: "lifecycle",
          message: "Adapter recovered after retry; resuming run",
          errorCode: "ADAPTER_TIMEOUT",
        },
      });

      const stored = await waitForCommentCount(db, run!.id, 1);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.body.startsWith(VIA_CHECK_IN_PREFIX)).toBe(true);
      expect(stored[0]!.body).toContain("ADAPTER_TIMEOUT");

      installation.dispose();

      // After dispose, no further posts.
      publish({
        companyId: company!.id,
        type: "heartbeat.run.event",
        payload: {
          runId: run!.id,
          eventType: "lifecycle",
          message: "another recovered event after dispose",
        },
      });
      // Wait long enough that any in-flight post would have landed by now;
      // assert the count stayed at 1 (i.e. dispose really stopped delivery).
      const after = await waitForCommentCount(db, run!.id, 2, 500);
      expect(after).toHaveLength(1);
    },
    20_000,
  );

  it(
    "ignores live events that don't match a check-in lifecycle category",
    async () => {
      const db = await freshDatabase();
      const [company] = await db
        .insert(companies)
        .values({ name: "Test Co", issuePrefix: "WR2" })
        .returning();
      const { ceo } = await seedCompanyAgents(db, { companyId: company!.id });
      const [issue] = await db
        .insert(issues)
        .values({ companyId: company!.id, title: "T", status: "todo" })
        .returning();
      const [run] = await db
        .insert(heartbeatRuns)
        .values({ companyId: company!.id, agentId: ceo.id, status: "running" })
        .returning();
      await db.update(issues).set({ executionRunId: run!.id }).where(eq(issues.id, issue!.id));

      const listeners = new Map<string, Array<(e: HeartbeatLiveEvent) => void>>();
      const subscribe: LiveEventSubscribe = (companyId, listener) => {
        const arr = listeners.get(companyId) ?? [];
        arr.push(listener);
        listeners.set(companyId, arr);
        return () => undefined;
      };

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      installCheckInPosterForCompany(company!.id, { subscribe, poster });

      // Stdout log line — not a lifecycle event.
      for (const fn of listeners.get(company!.id) ?? [])
        fn({
          companyId: company!.id,
          type: "heartbeat.run.log",
          payload: { runId: run!.id, message: "log line" },
        });
      // Lifecycle but with a message we don't classify.
      for (const fn of listeners.get(company!.id) ?? [])
        fn({
          companyId: company!.id,
          type: "heartbeat.run.event",
          payload: { runId: run!.id, eventType: "lifecycle", message: "Run started" },
        });

      // No matching event published, so wait a bounded interval and assert
      // nothing was posted.
      const stored = await waitForCommentCount(db, run!.id, 1, 500);
      expect(stored).toHaveLength(0);
    },
    20_000,
  );

  it(
    "installCheckInPosterAllCompanies: a single global subscription auto-wires every company including ones created after install",
    async () => {
      const db = await freshDatabase();

      // In-memory all-companies emitter — matches the shape of
      // `subscribeAllCompaniesLiveEvents(listener)` from server live-events.
      const allListeners = new Set<(e: HeartbeatLiveEvent) => void>();
      const subscribeAll: AllCompaniesLiveEventSubscribe = (listener) => {
        allListeners.add(listener);
        return () => {
          allListeners.delete(listener);
        };
      };
      function publish(event: HeartbeatLiveEvent) {
        for (const fn of allListeners) fn(event);
      }

      const poster = createCheckInPoster({
        db,
        resolveIssueIdForRun: (runId, companyId) =>
          resolveIssueIdForRunByExecution(db, runId, companyId),
      });

      // Install BEFORE any company exists — the global subscription is
      // installed once and lasts for the process.
      const installation = installCheckInPosterAllCompanies({ subscribeAll, poster });

      // Create company A AFTER install. This is the regression test for
      // the A-06.5 gap (per-company boot loop missed runtime creates).
      const [companyA] = await db
        .insert(companies)
        .values({ name: "Co A", issuePrefix: "ALA" })
        .returning();
      const { ceo: ceoA } = await seedCompanyAgents(db, { companyId: companyA!.id });
      const [issueA] = await db
        .insert(issues)
        .values({ companyId: companyA!.id, title: "T", status: "todo" })
        .returning();
      const [runA] = await db
        .insert(heartbeatRuns)
        .values({ companyId: companyA!.id, agentId: ceoA.id, status: "running" })
        .returning();
      await db.update(issues).set({ executionRunId: runA!.id }).where(eq(issues.id, issueA!.id));

      // Create company B too — same global listener should serve both.
      const [companyB] = await db
        .insert(companies)
        .values({ name: "Co B", issuePrefix: "ALB" })
        .returning();
      const { ceo: ceoB } = await seedCompanyAgents(db, { companyId: companyB!.id });
      const [issueB] = await db
        .insert(issues)
        .values({ companyId: companyB!.id, title: "T", status: "todo" })
        .returning();
      const [runB] = await db
        .insert(heartbeatRuns)
        .values({ companyId: companyB!.id, agentId: ceoB.id, status: "running" })
        .returning();
      await db.update(issues).set({ executionRunId: runB!.id }).where(eq(issues.id, issueB!.id));

      publish({
        companyId: companyA!.id,
        type: "heartbeat.run.event",
        payload: {
          runId: runA!.id,
          eventType: "lifecycle",
          message: "Adapter recovered after retry",
          errorCode: "ADAPTER_TIMEOUT",
        },
      });
      publish({
        companyId: companyB!.id,
        type: "heartbeat.run.event",
        payload: {
          runId: runB!.id,
          eventType: "lifecycle",
          message: "process_lost; queued retry",
        },
      });

      const storedA = await waitForCommentCount(db, runA!.id, 1);
      const storedB = await waitForCommentCount(db, runB!.id, 1);

      expect(storedA).toHaveLength(1);
      expect(storedA[0]!.body).toContain("ADAPTER_TIMEOUT");
      expect(storedB).toHaveLength(1);
      expect(storedB[0]!.body).toContain("restart");

      installation.dispose();
      // Global subscriber gone — no further posts even on a known company.
      publish({
        companyId: companyA!.id,
        type: "heartbeat.run.event",
        payload: {
          runId: runA!.id,
          eventType: "lifecycle",
          message: "another recovered event after dispose",
        },
      });
      const afterA = await waitForCommentCount(db, runA!.id, 2, 500);
      expect(afterA).toHaveLength(1);
    },
    20_000,
  );
});
