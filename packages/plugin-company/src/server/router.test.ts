import { afterEach, beforeAll, describe, expect, it } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  applyPendingMigrations,
  companies,
  companyProfiles,
  createDb,
  getEmbeddedPostgresTestSupport,
  issues,
  pendingReviews,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import { createPluginCompanyRouter, type PluginCompanyActorInfo } from "./router.js";
import { GETTING_STARTED_STEPS } from "../getting-started/steps.js";
import { seedCompanyAgents } from "../agents/factory.js";
import { submitForReview } from "../reviews/queue.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping plugin-company router tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-router-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return createDb(handle.connectionString);
}

interface AppCtx {
  db: Awaited<ReturnType<typeof freshDatabase>>;
  app: express.Express;
  /** Mutate to flip the next request's actor (e.g. simulate a 403 case). */
  setActor: (actor: PluginCompanyActorInfo | null) => void;
  /** Mutate to make `authorizeCompanyAccess` throw 403 for the next request. */
  setDenyCompanyId: (companyId: string | null) => void;
}

async function buildApp(): Promise<AppCtx> {
  const db = await freshDatabase();
  let actor: PluginCompanyActorInfo | null = {
    actorType: "user",
    actorId: "user-stub",
    agentId: null,
    runId: null,
  };
  let denyCompanyId: string | null = null;

  const app = express();
  app.use(express.json());
  app.use(
    createPluginCompanyRouter({
      db,
      authorizeCompanyAccess: (_req: Request, companyId: string) => {
        if (denyCompanyId && denyCompanyId === companyId) {
          const err = Object.assign(new Error("forbidden"), { status: 403 });
          throw err;
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
    db,
    app,
    setActor: (next) => {
      actor = next;
    },
    setDenyCompanyId: (id) => {
      denyCompanyId = id;
    },
  };
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>, prefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix: prefix })
    .returning();
  return company!;
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
  return issue!;
}

beforeAll(() => {
  // sanity: fail loud if the steps list ever drifts and breaks the schema enum.
  expect(GETTING_STARTED_STEPS.length).toBeGreaterThan(0);
});

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("plugin-company router (A-06.5)", () => {
  describe("checklist", () => {
    it("GET checklist returns the seeded total + zero completed on first read", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CL1");

      const res = await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/checklist`)
        .expect(200);
      expect(res.body.companyId).toBe(company.id);
      expect(res.body.completed).toBe(0);
      expect(Array.isArray(res.body.steps)).toBe(true);
      expect(res.body.total).toBe(GETTING_STARTED_STEPS.length);
    });

    it("POST complete-step bumps the completed counter", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CL2");
      const stepId = GETTING_STARTED_STEPS[0]!;

      const res = await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/checklist/${stepId}/complete`)
        .expect(200);
      expect(res.body.completed).toBe(1);
      const completedStep = res.body.steps.find((s: { key: string }) => s.key === stepId);
      expect(completedStep.completedAt).toBeTruthy();
    });

    it("POST complete-step rejects an unknown step with 400", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CL3");
      await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/checklist/not-a-real-step/complete`)
        .expect(400);
    });

    it("rejects a malformed companyId path-param with 400", async () => {
      const ctx = await buildApp();
      await request(ctx.app)
        .get("/companies/not-a-uuid/plugin-company/checklist")
        .expect(400);
    });

    it("propagates 403 from authorizeCompanyAccess", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CL4");
      ctx.setDenyCompanyId(company.id);
      await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/checklist`)
        .expect(403);
    });
  });

  describe("review queue", () => {
    it("GET pending lists open reviews scoped to the company", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV1");
      await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      const res = await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/reviews/pending`)
        .expect(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].review.status).toBe("pending");
      expect(res.body.reviews[0].issue.id).toBe(issue.id);
    });

    it("POST approve flips the issue to done and removes it from pending", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV2");
      await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      const review = await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      const approveRes = await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/approve`)
        .send({ decisionNote: "looks good" })
        .expect(200);
      expect(approveRes.body.review.status).toBe("approved");
      expect(approveRes.body.review.decisionNote).toBe("looks good");

      const [updatedIssue] = await ctx.db.select().from(issues).where(eq(issues.id, issue.id));
      expect(updatedIssue!.status).toBe("done");

      const pending = await ctx.db
        .select()
        .from(pendingReviews)
        .where(eq(pendingReviews.companyId, company.id));
      expect(pending.find((row) => row.id === review.id)!.status).toBe("approved");
    });

    it("POST reject flips the issue back to todo", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV3");
      await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      const review = await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/reject`)
        .send({})
        .expect(200);

      const [updatedIssue] = await ctx.db.select().from(issues).where(eq(issues.id, issue.id));
      expect(updatedIssue!.status).toBe("todo");
    });

    it("approving an already-decided review returns 409", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV4");
      await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      const review = await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/approve`)
        .send({})
        .expect(200);
      await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/approve`)
        .send({})
        .expect(409);
    });

    it("attributes the decider to the calling agent when actor.type=agent", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV5");
      const { ceo } = await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      const review = await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      ctx.setActor({
        actorType: "agent",
        actorId: ceo.id,
        agentId: ceo.id,
        runId: null,
      });

      const res = await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/approve`)
        .send({})
        .expect(200);
      expect(res.body.review.decidedByAgentId).toBe(ceo.id);
      expect(res.body.review.decidedByUserId).toBeNull();
    });

    it("rejects an unknown body field with 400 (strict zod schema)", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "RV6");
      await seedCompanyAgents(ctx.db, { companyId: company.id });
      const issue = await freshIssue(ctx.db, company.id);
      const review = await submitForReview(ctx.db, { companyId: company.id, issueId: issue.id });

      await request(ctx.app)
        .post(`/companies/${company.id}/plugin-company/reviews/${review.id}/approve`)
        .send({ unexpected: "field" })
        .expect(400);
    });
  });

  describe("CompanyProfile CRUD", () => {
    it("GET profile returns 404 before any profile exists", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP1");
      await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/profile`)
        .expect(404);
    });

    it("PUT profile creates a row, GET returns it, PATCH updates fields, DELETE removes it", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP2");

      const created = await request(ctx.app)
        .put(`/companies/${company.id}/plugin-company/profile`)
        .send({
          name: "Atlas Dynamics",
          description: "Robotics R&D",
          incorporated: false,
          trialState: "trial",
        })
        .expect(200);
      expect(created.body.profile.name).toBe("Atlas Dynamics");
      expect(created.body.profile.description).toBe("Robotics R&D");
      expect(created.body.profile.trialState).toBe("trial");
      expect(created.body.profile.companyId).toBe(company.id);

      const got = await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/profile`)
        .expect(200);
      expect(got.body.profile.id).toBe(created.body.profile.id);

      const patched = await request(ctx.app)
        .patch(`/companies/${company.id}/plugin-company/profile`)
        .send({ description: "Robotics + ML R&D", incorporated: true })
        .expect(200);
      expect(patched.body.profile.description).toBe("Robotics + ML R&D");
      expect(patched.body.profile.incorporated).toBe(true);
      // PATCH preserves untouched fields.
      expect(patched.body.profile.name).toBe("Atlas Dynamics");

      await request(ctx.app)
        .delete(`/companies/${company.id}/plugin-company/profile`)
        .expect(204);
      await request(ctx.app)
        .get(`/companies/${company.id}/plugin-company/profile`)
        .expect(404);
    });

    it("PUT profile is idempotent — second call updates rather than duplicating", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP3");
      await request(ctx.app)
        .put(`/companies/${company.id}/plugin-company/profile`)
        .send({ name: "v1" })
        .expect(200);
      const second = await request(ctx.app)
        .put(`/companies/${company.id}/plugin-company/profile`)
        .send({ name: "v2", description: "second pass" })
        .expect(200);
      expect(second.body.profile.name).toBe("v2");

      const rows = await ctx.db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.companyId, company.id));
      expect(rows).toHaveLength(1);
    });

    it("PATCH profile rejects an empty body with 400", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP4");
      await request(ctx.app)
        .put(`/companies/${company.id}/plugin-company/profile`)
        .send({ name: "v1" })
        .expect(200);
      await request(ctx.app)
        .patch(`/companies/${company.id}/plugin-company/profile`)
        .send({})
        .expect(400);
    });

    it("PUT profile rejects an invalid trialState", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP5");
      await request(ctx.app)
        .put(`/companies/${company.id}/plugin-company/profile`)
        .send({ name: "v1", trialState: "bogus" })
        .expect(400);
    });

    it("DELETE profile returns 404 when nothing to delete", async () => {
      const ctx = await buildApp();
      const company = await freshCompany(ctx.db, "CP6");
      await request(ctx.app)
        .delete(`/companies/${company.id}/plugin-company/profile`)
        .expect(404);
    });
  });
});
