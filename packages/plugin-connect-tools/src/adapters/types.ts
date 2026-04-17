/**
 * The six tool kinds supported by the B-14 scaffold. Adding a new adapter
 * means: (1) extending this union, (2) adding a `ToolAdapter` to
 * `./registry.ts`, (3) regenerating any consumer types. The DB column
 * `connections.tool_kind` is `text` rather than a Postgres enum, so adding a
 * value here does NOT require a migration — only the Zod schema in
 * `../server/schemas.ts` enforces the closed set at the HTTP boundary.
 */
export type ConnectionToolKind =
  | "notion"
  | "slack"
  | "figma"
  | "github"
  | "linear"
  | "vercel";

/** Static metadata describing a connectable tool. */
export interface ToolAdapter {
  readonly kind: ConnectionToolKind;
  readonly displayName: string;
  readonly homepageUrl: string;
  /** Read-only scopes requested at OAuth-grant time (Phase 2 wires the grant flow). */
  readonly defaultScopes: readonly string[];
  /** Upstream OAuth authorize endpoint (Phase 2 redirects users here). */
  readonly oauthAuthUrl: string;
  /** Upstream token-exchange endpoint. */
  readonly oauthTokenUrl: string;
}
