/**
 * Deterministic Next.js 15 / App Router scaffold used by the B-02 builder
 * worker. No network calls, no LLM — the builder's job in this scaffold
 * step is just to produce a coherent file tree under `apps/<app_id>/` that
 * reflects the caller's prompt. A real "Landing Page Engineer" run (Phase 2)
 * will replace `generateHeroContent` with model output.
 */

export interface ScaffoldInput {
  readonly appId: string;
  readonly appName: string;
  readonly prompt: string;
}

export interface ScaffoldedFile {
  readonly path: string;
  readonly content: string;
}

export const SCAFFOLD_FILE_PATHS = [
  "package.json",
  "next.config.mjs",
  "tsconfig.json",
  "app/layout.tsx",
  "app/page.tsx",
  "app/globals.css",
  "app/api/health/route.ts",
  "README.md",
] as const;

export function scaffoldNextJsFiles(input: ScaffoldInput): ScaffoldedFile[] {
  const root = `apps/${input.appId}`;
  const { appName, prompt } = input;
  const slug = slugify(appName);

  return [
    { path: `${root}/package.json`, content: packageJson(slug) },
    { path: `${root}/next.config.mjs`, content: NEXT_CONFIG },
    { path: `${root}/tsconfig.json`, content: TSCONFIG },
    { path: `${root}/app/layout.tsx`, content: layoutTsx(appName) },
    { path: `${root}/app/page.tsx`, content: pageTsx(appName, prompt) },
    { path: `${root}/app/globals.css`, content: GLOBALS_CSS },
    { path: `${root}/app/api/health/route.ts`, content: HEALTH_ROUTE },
    { path: `${root}/README.md`, content: readmeMd(appName, prompt) },
  ];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

function packageJson(slug: string): string {
  return `${JSON.stringify(
    {
      name: slug,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "^15.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
      devDependencies: {
        "@types/node": "^24.0.0",
        "@types/react": "^19.0.0",
        typescript: "^5.7.0",
      },
    },
    null,
    2,
  )}\n`;
}

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  },
  null,
  2,
)}\n`;

function layoutTsx(appName: string): string {
  return `import "./globals.css";

export const metadata = {
  title: "${escapeTsString(appName)}",
  description: "Landing page for ${escapeTsString(appName)}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function pageTsx(appName: string, prompt: string): string {
  const hero = deriveHero(prompt);
  return `export default function Page() {
  return (
    <main className="hero">
      <h1>${escapeTsString(appName)}</h1>
      <p>${escapeTsString(hero)}</p>
    </main>
  );
}
`;
}

const GLOBALS_CSS = `:root {
  --fg: #0e0e10;
  --bg: #fafafa;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--fg);
  background: var(--bg);
}

.hero {
  min-height: 100svh;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 2rem;
}

.hero h1 { font-size: 3rem; margin: 0 0 1rem; }
.hero p { font-size: 1.25rem; max-width: 48ch; margin: 0; }
`;

const HEALTH_ROUTE = `export function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
`;

function readmeMd(appName: string, prompt: string): string {
  return `# ${appName}

Scaffolded by the Company.dev apps-builder (B-02). Edit \`app/page.tsx\`
to replace the generated hero.

## Prompt
${prompt}

## Scripts
- \`next dev\` — local dev
- \`next build\` — production build
- \`next start\` — run the production build
`;
}

/** Derive a 1-sentence hero from the caller's prompt, clamped to 240 chars. */
export function deriveHero(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return "A new landing page, ready to ship.";
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  if (firstSentence.length <= 240) return firstSentence;
  return firstSentence.slice(0, 237).trimEnd() + "…";
}

/**
 * Escape a string for embedding inside a TypeScript double-quoted literal.
 * The scaffold output is committed to the DB and later read out verbatim, so
 * a `"` or backslash in a user-supplied `appName` must not break the file.
 */
function escapeTsString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
