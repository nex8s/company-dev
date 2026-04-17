import { describe, expect, it } from "vitest";
import { deriveHero, scaffoldNextJsFiles, SCAFFOLD_FILE_PATHS } from "./scaffold.js";

const APP_ID = "00000000-0000-0000-0000-000000000001";

describe("scaffoldNextJsFiles (B-02)", () => {
  it("produces one file per SCAFFOLD_FILE_PATHS, all rooted under apps/<app_id>/", () => {
    const files = scaffoldNextJsFiles({
      appId: APP_ID,
      appName: "Acme",
      prompt: "A tool for engineers.",
    });
    expect(files.map((f) => f.path).sort()).toEqual(
      SCAFFOLD_FILE_PATHS.map((p) => `apps/${APP_ID}/${p}`).sort(),
    );
    for (const f of files) {
      expect(f.path.startsWith(`apps/${APP_ID}/`)).toBe(true);
      expect(f.content.length).toBeGreaterThan(0);
    }
  });

  it("package.json name is a slugified form of the app name and parses as JSON", () => {
    const files = scaffoldNextJsFiles({
      appId: APP_ID,
      appName: "Launch LAND-ing!",
      prompt: "any",
    });
    const pkg = files.find((f) => f.path.endsWith("/package.json"))!;
    const parsed = JSON.parse(pkg.content) as { name: string };
    expect(parsed.name).toBe("launch-land-ing");
  });

  it("page.tsx embeds the app name and a hero derived from the prompt", () => {
    const files = scaffoldNextJsFiles({
      appId: APP_ID,
      appName: "Acme",
      prompt: "Sentence one. Sentence two.",
    });
    const page = files.find((f) => f.path.endsWith("/app/page.tsx"))!;
    expect(page.content).toContain("Acme");
    expect(page.content).toContain("Sentence one.");
    expect(page.content).not.toContain("Sentence two.");
  });

  it('escapes " and \\ in app names so generated TSX stays valid', () => {
    const files = scaffoldNextJsFiles({
      appId: APP_ID,
      appName: 'Acme "Co" \\edge',
      prompt: "ok",
    });
    const page = files.find((f) => f.path.endsWith("/app/page.tsx"))!;
    expect(page.content).toContain('Acme \\"Co\\" \\\\edge');
  });

  it("empty prompt falls back to a sensible default hero", () => {
    expect(deriveHero("")).toMatch(/ready to ship/i);
    expect(deriveHero("   ")).toMatch(/ready to ship/i);
  });

  it("very long hero is clamped to ≤240 chars with an ellipsis", () => {
    const longSentence = "x".repeat(500) + ".";
    const hero = deriveHero(longSentence);
    expect(hero.length).toBeLessThanOrEqual(240);
    expect(hero.endsWith("…")).toBe(true);
  });
});
