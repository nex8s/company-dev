import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  issues,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  approveReview,
  ISSUE_STATUS_APPROVED,
  ISSUE_STATUS_IN_REVIEW,
  ISSUE_STATUS_REJECTED,
  listPendingReviews,
  rejectReview,
  submitForReview,
} from "./queue.js";
import { hireAgent, seedCompanyAgents } from "../agents/factory.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping pending review tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-reviews-");
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
  title = "Draft landing copy",
) {
  const [issue] = await db
    .insert(issues)
    .values({ companyId, title, status: "todo" })
    .returning();
  return issue;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("pending review queue (A-05)", () => {
  it(
    "submitForReview enqueues the review and flips issue status to in_review",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "SUB");
      await seedCompanyAgents(db, { companyId: company.id });
      const marketer = await hireAgent(db, {
        companyId: company.id,
        department: "marketing",
        name: "Mira",
      });
      const issue = await freshIssue(db, company.id);

      const review = await submitForReview(db, {
        companyId: company.id,
        issueId: issue.id,
        submittedByAgentId: marketer.id,
        submissionNote: "Ready for CEO sign-off",
      });

      expect(review.status).toBe("pending");
      expect(review.companyId).toBe(company.id);
      expect(review.issueId).toBe(issue.id);
      expect(review.submittedByAgentId).toBe(marketer.id);
      expect(review.submissionNote).toBe("Ready for CEO sign-off");

      const [issueAfter] = await db.select().from(issues).where(eq(issues.id, issue.id));
      expect(issueAfter.status).toBe(ISSUE_STATUS_IN_REVIEW);
    },
    60_000,
  );

  it(
    "listPendingReviews returns the submitted review with its underlying issue",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "LST");
      const issue = await freshIssue(db, company.id, "Launch post copy");

      await submitForReview(db, { companyId: company.id, issueId: issue.id });

      const queue = await listPendingReviews(db, company.id);
      expect(queue).toHaveLength(1);
      expect(queue[0].review.issueId).toBe(issue.id);
      expect(queue[0].issue.id).toBe(issue.id);
      expect(queue[0].issue.title).toBe("Launch post copy");
      expect(queue[0].issue.status).toBe(ISSUE_STATUS_IN_REVIEW);
    },
    60_000,
  );

  it(
    "approveReview removes the review from the queue and marks the issue done",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "APR");
      await seedCompanyAgents(db, { companyId: company.id });
      const issue = await freshIssue(db, company.id);

      const review = await submitForReview(db, { companyId: company.id, issueId: issue.id });
      expect((await listPendingReviews(db, company.id))).toHaveLength(1);

      const approved = await approveReview(db, {
        reviewId: review.id,
        decidedByUserId: "user_founder",
        decisionNote: "Ship it",
      });
      expect(approved.status).toBe("approved");
      expect(approved.decisionNote).toBe("Ship it");
      expect(approved.decidedAt).toBeInstanceOf(Date);

      expect(await listPendingReviews(db, company.id)).toHaveLength(0);

      const [issueAfter] = await db.select().from(issues).where(eq(issues.id, issue.id));
      expect(issueAfter.status).toBe(ISSUE_STATUS_APPROVED);
    },
    60_000,
  );

  it(
    "rejectReview flips the issue status back to todo and marks review rejected",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "REJ");
      const issue = await freshIssue(db, company.id);

      const review = await submitForReview(db, { companyId: company.id, issueId: issue.id });
      expect((await listPendingReviews(db, company.id))).toHaveLength(1);

      const rejected = await rejectReview(db, {
        reviewId: review.id,
        decisionNote: "Needs a stronger hook",
      });
      expect(rejected.status).toBe("rejected");
      expect(rejected.decisionNote).toBe("Needs a stronger hook");

      expect(await listPendingReviews(db, company.id)).toHaveLength(0);

      const [issueAfter] = await db.select().from(issues).where(eq(issues.id, issue.id));
      expect(issueAfter.status).toBe(ISSUE_STATUS_REJECTED);
    },
    60_000,
  );

  it(
    "approve and reject both refuse to act on an already-decided review",
    async () => {
      const db = await freshDatabase();
      const company = await freshCompany(db, "TWC");
      const issue = await freshIssue(db, company.id);
      const review = await submitForReview(db, { companyId: company.id, issueId: issue.id });

      await approveReview(db, { reviewId: review.id });

      await expect(approveReview(db, { reviewId: review.id })).rejects.toThrow(
        /not found or already decided/,
      );
      await expect(rejectReview(db, { reviewId: review.id })).rejects.toThrow(
        /not found or already decided/,
      );
    },
    60_000,
  );

  it(
    "the queue is scoped per company",
    async () => {
      const db = await freshDatabase();
      const a = await freshCompany(db, "AAA");
      const b = await freshCompany(db, "BBB");
      const issueA = await freshIssue(db, a.id, "A-task");
      const issueB = await freshIssue(db, b.id, "B-task");

      await submitForReview(db, { companyId: a.id, issueId: issueA.id });
      await submitForReview(db, { companyId: b.id, issueId: issueB.id });

      const queueA = await listPendingReviews(db, a.id);
      const queueB = await listPendingReviews(db, b.id);

      expect(queueA).toHaveLength(1);
      expect(queueA[0].issue.title).toBe("A-task");
      expect(queueB).toHaveLength(1);
      expect(queueB[0].issue.title).toBe("B-task");
    },
    60_000,
  );
});
