import { and, eq } from "drizzle-orm";
import { type Db, issueComments, issues } from "@paperclipai/db";

/**
 * Lifecycle phases that produce a "via check-in" comment in the company
 * chat thread. The gate (A-06) only requires error_recovery to round-trip,
 * but the same code path handles the other two phases Paperclip emits.
 */
export type CheckInLifecycleKind = "error_recovery" | "restart" | "retry";

export interface RunLifecycleEvent {
  readonly runId: string;
  readonly companyId: string;
  readonly kind: CheckInLifecycleKind;
  /** Optional human-readable detail (error message, retry attempt label, etc). */
  readonly detail?: string | null;
  /** Optional error code observed for error_recovery events. */
  readonly errorCode?: string | null;
}

export interface CheckInPosterDeps {
  readonly db: Db;
  /**
   * Resolves the issue ID backing the chat thread for a given run. Returning
   * null skips the post (e.g. ad-hoc runs not tied to an issue).
   */
  readonly resolveIssueIdForRun: (runId: string, companyId: string) => Promise<string | null>;
}

export interface CheckInPostResult {
  /** Comment ID that satisfies the check-in (newly inserted OR an existing duplicate). */
  readonly commentId: string | null;
  /** Why the post was a no-op, if applicable. */
  readonly skipped?: "no-issue" | "duplicate";
}

export const VIA_CHECK_IN_PREFIX = "via check-in:";

/**
 * Default issue resolver: looks up the issue currently bound to the run via
 * `issues.execution_run_id`. Plugin wiring code in the server is expected to
 * pass this (or a richer resolver that also consults the run's contextSnapshot).
 */
export async function resolveIssueIdForRunByExecution(
  db: Db,
  runId: string,
  companyId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.companyId, companyId), eq(issues.executionRunId, runId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Format the body of the system check-in comment. Bodies are deterministic so
 * the duplicate-detection in `postCheckIn` can use exact body equality —
 * Paperclip's `issue_comments` table has no natural unique key for this case.
 */
export function formatCheckInBody(event: RunLifecycleEvent): string {
  const detail = event.detail?.trim() ? ` — ${event.detail.trim()}` : "";
  switch (event.kind) {
    case "error_recovery": {
      const code = event.errorCode?.trim() ? ` (${event.errorCode.trim()})` : "";
      return `${VIA_CHECK_IN_PREFIX} run recovered from error${code}${detail}`;
    }
    case "restart":
      return `${VIA_CHECK_IN_PREFIX} run restarted${detail}`;
    case "retry":
      return `${VIA_CHECK_IN_PREFIX} run retried${detail}`;
  }
}

export interface CheckInPoster {
  postCheckIn: (event: RunLifecycleEvent) => Promise<CheckInPostResult>;
}

/**
 * Build the check-in poster. The poster is the leaf operation: it inserts a
 * single `issue_comments` row tagged with the originating runId. Subscribing
 * the poster to Paperclip's run-status stream is the wiring layer's job and
 * lives in the server bootstrap (server/src/services/plugin-company-wire.ts
 * once A-06 lands its route module — see A-06.5).
 */
export function createCheckInPoster(deps: CheckInPosterDeps): CheckInPoster {
  async function postCheckIn(event: RunLifecycleEvent): Promise<CheckInPostResult> {
    const issueId = await deps.resolveIssueIdForRun(event.runId, event.companyId);
    if (!issueId) return { commentId: null, skipped: "no-issue" };

    const body = formatCheckInBody(event);

    const existing = await deps.db
      .select({ id: issueComments.id })
      .from(issueComments)
      .where(
        and(
          eq(issueComments.companyId, event.companyId),
          eq(issueComments.issueId, issueId),
          eq(issueComments.createdByRunId, event.runId),
          eq(issueComments.body, body),
        ),
      )
      .limit(1);
    if (existing[0]) return { commentId: existing[0].id, skipped: "duplicate" };

    const [row] = await deps.db
      .insert(issueComments)
      .values({
        companyId: event.companyId,
        issueId,
        createdByRunId: event.runId,
        authorAgentId: null,
        authorUserId: null,
        body,
      })
      .returning({ id: issueComments.id });

    return { commentId: row?.id ?? null };
  }

  return { postCheckIn };
}
