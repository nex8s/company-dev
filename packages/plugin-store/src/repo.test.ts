import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryStoreTemplatesRepository, listTemplates } from "./repo.js";
import { seedTemplates } from "./seeds/index.js";

describe("plugin-store · StoreTemplatesRepository", () => {
  let repo: InMemoryStoreTemplatesRepository;

  beforeEach(async () => {
    repo = new InMemoryStoreTemplatesRepository();
    await repo.loadSeeds(seedTemplates);
  });

  it("loads exactly 6 seed templates", async () => {
    expect(await repo.count()).toBe(6);
    const all = await listTemplates(repo);
    expect(all).toHaveLength(6);
  });

  it("seeds each of the 6 expected slugs", async () => {
    const slugs = (await listTemplates(repo)).map((t) => t.slug).sort();
    expect(slugs).toEqual(
      [
        "b2b-outbound-machine",
        "dev-agency",
        "devops-monitoring-ops",
        "faceless-youtube",
        "smma",
        "youtube-long-form",
      ].sort(),
    );
  });

  it("every seed has the required shape", async () => {
    for (const t of await listTemplates(repo)) {
      expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.summary.length).toBeGreaterThan(0);
      expect(t.category.length).toBeGreaterThan(0);
      expect(t.kind).toMatch(/^(business|employee)$/);
      expect(t.creator.length).toBeGreaterThan(0);
      expect(Array.isArray(t.skills)).toBe(true);
      expect(t.skills.length).toBeGreaterThan(0);
      expect(Array.isArray(t.employees)).toBe(true);
      expect(t.employees.length).toBeGreaterThan(0);
      for (const emp of t.employees) {
        expect(emp.role.length).toBeGreaterThan(0);
        expect(emp.department).toMatch(/^(engineering|marketing|operations|sales|support)$/);
        expect(emp.model.length).toBeGreaterThan(0);
        expect(emp.schedule.length).toBeGreaterThan(0);
        expect(Array.isArray(emp.responsibilities)).toBe(true);
        expect(emp.responsibilities.length).toBeGreaterThan(0);
      }
      expect(t.downloadCount).toBe(0);
    }
  });

  it("listTemplates filters by category", async () => {
    const agencies = await listTemplates(repo, { category: "Agency & Services" });
    expect(agencies.map((t) => t.slug).sort()).toEqual(["dev-agency", "smma"]);

    const media = await listTemplates(repo, { category: "Media & Content" });
    expect(media.map((t) => t.slug)).toEqual(["faceless-youtube"]);

    const none = await listTemplates(repo, { category: "Not A Category" });
    expect(none).toEqual([]);
  });

  it("listTemplates filters by kind", async () => {
    const businesses = await listTemplates(repo, { kind: "business" });
    expect(businesses).toHaveLength(6);

    const employees = await listTemplates(repo, { kind: "employee" });
    expect(employees).toEqual([]);
  });

  it("listTemplates combines category + kind filters", async () => {
    const agencyBusinesses = await listTemplates(repo, {
      category: "Agency & Services",
      kind: "business",
    });
    expect(agencyBusinesses.map((t) => t.slug).sort()).toEqual(["dev-agency", "smma"]);

    const agencyEmployees = await listTemplates(repo, {
      category: "Agency & Services",
      kind: "employee",
    });
    expect(agencyEmployees).toEqual([]);
  });

  it("getBySlug returns a loaded template", async () => {
    const t = await repo.getBySlug("smma");
    expect(t?.title).toBe("SMMA (Social Media Marketing)");

    const missing = await repo.getBySlug("nope");
    expect(missing).toBeNull();
  });

  it("rejects duplicate seed slugs on a second loadSeeds", async () => {
    await expect(repo.loadSeeds(seedTemplates)).rejects.toThrow(/duplicate seed slug/);
  });
});
