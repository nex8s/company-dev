import { describe, expect, it } from "vitest";
import { buildFileTree } from "./file-tree.js";

const APP_ID = "00000000-0000-0000-0000-0000000000aa";

describe("buildFileTree (B-03)", () => {
  it("nests files into directories and strips the apps/<appId>/ prefix", () => {
    const tree = buildFileTree(APP_ID, [
      { path: `apps/${APP_ID}/package.json`, sizeBytes: 200 },
      { path: `apps/${APP_ID}/app/page.tsx`, sizeBytes: 150 },
      { path: `apps/${APP_ID}/app/layout.tsx`, sizeBytes: 120 },
      { path: `apps/${APP_ID}/app/api/health/route.ts`, sizeBytes: 80 },
    ]);

    expect(tree.kind).toBe("directory");
    expect(tree.path).toBe("");

    // Top level: directories first, then files. Only one directory ("app")
    // plus one file ("package.json") at this level.
    const top = tree.children.map((c) => ({ kind: c.kind, name: c.name }));
    expect(top).toEqual([
      { kind: "directory", name: "app" },
      { kind: "file", name: "package.json" },
    ]);

    const appDir = tree.children[0];
    if (appDir?.kind !== "directory") throw new Error("app dir missing");
    const appChildren = appDir.children.map((c) => ({ kind: c.kind, name: c.name }));
    expect(appChildren).toEqual([
      { kind: "directory", name: "api" },
      { kind: "file", name: "layout.tsx" },
      { kind: "file", name: "page.tsx" },
    ]);

    const apiDir = appDir.children[0];
    if (apiDir?.kind !== "directory") throw new Error("api dir missing");
    const healthDir = apiDir.children[0];
    if (healthDir?.kind !== "directory") throw new Error("health dir missing");
    expect(healthDir.path).toBe("app/api/health");
    expect(healthDir.children).toEqual([
      { kind: "file", name: "route.ts", path: "app/api/health/route.ts", sizeBytes: 80 },
    ]);
  });

  it("carries sizeBytes through to the leaf nodes", () => {
    const tree = buildFileTree(APP_ID, [
      { path: `apps/${APP_ID}/package.json`, sizeBytes: 1337 },
    ]);
    const [pkg] = tree.children;
    expect(pkg).toEqual({
      kind: "file",
      name: "package.json",
      path: "package.json",
      sizeBytes: 1337,
    });
  });

  it("skips inputs whose path does NOT match the apps/<appId>/ prefix", () => {
    const tree = buildFileTree(APP_ID, [
      { path: `apps/${APP_ID}/package.json`, sizeBytes: 1 },
      { path: `apps/some-other-app/package.json`, sizeBytes: 2 },
      { path: `random/path.txt`, sizeBytes: 3 },
    ]);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({ kind: "file", name: "package.json" });
  });

  it("is stable across input orderings — directories first, alphabetical siblings", () => {
    const a = buildFileTree(APP_ID, [
      { path: `apps/${APP_ID}/zoo.txt`, sizeBytes: 1 },
      { path: `apps/${APP_ID}/apple/core.ts`, sizeBytes: 1 },
      { path: `apps/${APP_ID}/banana.md`, sizeBytes: 1 },
    ]);
    const b = buildFileTree(APP_ID, [
      { path: `apps/${APP_ID}/banana.md`, sizeBytes: 1 },
      { path: `apps/${APP_ID}/zoo.txt`, sizeBytes: 1 },
      { path: `apps/${APP_ID}/apple/core.ts`, sizeBytes: 1 },
    ]);
    const names = (t: typeof a) => t.children.map((c) => `${c.kind}:${c.name}`);
    expect(names(a)).toEqual(names(b));
    expect(names(a)).toEqual(["directory:apple", "file:banana.md", "file:zoo.txt"]);
  });

  it("handles an empty file list (returns an empty root directory)", () => {
    const tree = buildFileTree(APP_ID, []);
    expect(tree.kind).toBe("directory");
    expect(tree.children).toEqual([]);
  });
});
