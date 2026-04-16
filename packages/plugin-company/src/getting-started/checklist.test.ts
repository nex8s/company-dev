import { afterEach, describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  companies,
  createDb,
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@paperclipai/db";
import {
  completeStep,
  getChecklist,
  resetStep,
} from "./checklist.js";
import { GETTING_STARTED_STEPS, GETTING_STARTED_TOTAL } from "./steps.js";

const cleanups: Array<() => Promise<void> | void> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping Getting Started tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function freshDatabase() {
  const handle = await startEmbeddedPostgresTestDatabase("paperclip-plugin-company-gs-");
  cleanups.push(handle.cleanup);
  await applyPendingMigrations(handle.connectionString);
  return { db: createDb(handle.connectionString), connectionString: handle.connectionString };
}

async function freshCompany(db: Awaited<ReturnType<typeof freshDatabase>>["db"], issuePrefix: string) {
  const [company] = await db
    .insert(companies)
    .values({ name: "Test Co", issuePrefix })
    .returning();
  return company;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

describeEmbeddedPostgres("Getting Started checklist (A-04)", () => {
  it(
    "initializes a fresh checklist with 0/7 and all seven steps",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "FRE");

      const cl = await getChecklist(db, company.id);

      expect(cl.total).toBe(GETTING_STARTED_TOTAL);
      expect(cl.total).toBe(7);
      expect(cl.completed).toBe(0);
      expect(cl.steps).toHaveLength(7);
      expect(cl.steps.map((s) => s.key)).toEqual([...GETTING_STARTED_STEPS]);
      for (const s of cl.steps) expect(s.completedAt).toBeNull();
    },
    60_000,
  );

  it(
    "completing one step yields progress 1/7 (gate: complete step 5)",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "GT5");

      const cl = await completeStep(db, company.id, "deploy_first_app");

      expect(cl.completed).toBe(1);
      expect(cl.total).toBe(7);
      const deploy = cl.steps.find((s) => s.key === "deploy_first_app");
      expect(deploy?.completedAt).toBeInstanceOf(Date);

      const others = cl.steps.filter((s) => s.key !== "deploy_first_app");
      for (const other of others) expect(other.completedAt).toBeNull();
    },
    60_000,
  );

  it(
    "subsequent steps complete independently and progress increments",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "IND");

      await completeStep(db, company.id, "incorporate");
      expect((await getChecklist(db, company.id)).completed).toBe(1);

      await completeStep(db, company.id, "stripe_billing");
      expect((await getChecklist(db, company.id)).completed).toBe(2);

      await completeStep(db, company.id, "custom_dashboard_pages");
      const cl = await getChecklist(db, company.id);
      expect(cl.completed).toBe(3);

      const completedKeys = cl.steps.filter((s) => s.completedAt).map((s) => s.key).sort();
      expect(completedKeys).toEqual(["custom_dashboard_pages", "incorporate", "stripe_billing"]);
    },
    60_000,
  );

  it(
    "completing the same step twice is idempotent (first completedAt preserved)",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "IDM");

      const first = await completeStep(db, company.id, "domain");
      const firstDate = first.steps.find((s) => s.key === "domain")?.completedAt;
      expect(firstDate).toBeInstanceOf(Date);

      await new Promise((r) => setTimeout(r, 20));

      const second = await completeStep(db, company.id, "domain");
      const secondDate = second.steps.find((s) => s.key === "domain")?.completedAt;

      expect(secondDate?.getTime()).toBe(firstDate?.getTime());
      expect(second.completed).toBe(1);
    },
    60_000,
  );

  it(
    "state survives a restart (fresh client connected to the same DB sees the same state)",
    async () => {
      const { db: dbA, connectionString } = await freshDatabase();
      const company = await freshCompany(dbA, "RST");

      await completeStep(dbA, company.id, "google_search_console");
      await completeStep(dbA, company.id, "email_inboxes");

      const freshClient = createDb(connectionString);
      const cl = await getChecklist(freshClient, company.id);

      expect(cl.completed).toBe(2);
      const completedKeys = cl.steps.filter((s) => s.completedAt).map((s) => s.key).sort();
      expect(completedKeys).toEqual(["email_inboxes", "google_search_console"]);
    },
    60_000,
  );

  it(
    "resetStep returns a completed step to not-completed",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "RSE");

      await completeStep(db, company.id, "deploy_first_app");
      expect((await getChecklist(db, company.id)).completed).toBe(1);

      const cl = await resetStep(db, company.id, "deploy_first_app");
      expect(cl.completed).toBe(0);
      const deploy = cl.steps.find((s) => s.key === "deploy_first_app");
      expect(deploy?.completedAt).toBeNull();
    },
    60_000,
  );

  it(
    "completeStep rejects unknown step keys",
    async () => {
      const { db } = await freshDatabase();
      const company = await freshCompany(db, "UNK");

      await expect(completeStep(db, company.id, "launch_rocket")).rejects.toThrow(
        /unknown Getting Started step/,
      );
    },
    60_000,
  );

  it(
    "progress is isolated per company (completing one company's step does not touch another's)",
    async () => {
      const { db } = await freshDatabase();
      const a = await freshCompany(db, "AAA");
      const b = await freshCompany(db, "BBB");

      await completeStep(db, a.id, "incorporate");

      expect((await getChecklist(db, a.id)).completed).toBe(1);
      expect((await getChecklist(db, b.id)).completed).toBe(0);
    },
    60_000,
  );
});
