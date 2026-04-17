import type { ConnectionToolKind, ToolAdapter } from "./types.js";

/**
 * The six initial adapters scaffolded by B-14. Real OAuth implementations
 * arrive with the OSS integration project the orchestrator will merge later;
 * this file just nails down the metadata each adapter exposes so the storage
 * layer + UI can already round-trip a connection.
 */
export const adapterRegistry: Readonly<Record<ConnectionToolKind, ToolAdapter>> = Object.freeze({
  notion: {
    kind: "notion",
    displayName: "Notion",
    homepageUrl: "https://www.notion.so",
    defaultScopes: ["read_content", "read_user"] as const,
    oauthAuthUrl: "https://api.notion.com/v1/oauth/authorize",
    oauthTokenUrl: "https://api.notion.com/v1/oauth/token",
  },
  slack: {
    kind: "slack",
    displayName: "Slack",
    homepageUrl: "https://slack.com",
    defaultScopes: ["channels:read", "users:read", "chat:write"] as const,
    oauthAuthUrl: "https://slack.com/oauth/v2/authorize",
    oauthTokenUrl: "https://slack.com/api/oauth.v2.access",
  },
  figma: {
    kind: "figma",
    displayName: "Figma",
    homepageUrl: "https://www.figma.com",
    defaultScopes: ["files:read"] as const,
    oauthAuthUrl: "https://www.figma.com/oauth",
    oauthTokenUrl: "https://www.figma.com/api/oauth/token",
  },
  github: {
    kind: "github",
    displayName: "GitHub",
    homepageUrl: "https://github.com",
    defaultScopes: ["repo:read", "read:user"] as const,
    oauthAuthUrl: "https://github.com/login/oauth/authorize",
    oauthTokenUrl: "https://github.com/login/oauth/access_token",
  },
  linear: {
    kind: "linear",
    displayName: "Linear",
    homepageUrl: "https://linear.app",
    defaultScopes: ["read"] as const,
    oauthAuthUrl: "https://linear.app/oauth/authorize",
    oauthTokenUrl: "https://api.linear.app/oauth/token",
  },
  vercel: {
    kind: "vercel",
    displayName: "Vercel",
    homepageUrl: "https://vercel.com",
    defaultScopes: ["read:project", "read:deployment"] as const,
    oauthAuthUrl: "https://vercel.com/oauth/authorize",
    oauthTokenUrl: "https://api.vercel.com/v2/oauth/access_token",
  },
});

export const SUPPORTED_TOOL_KINDS: readonly ConnectionToolKind[] = Object.freeze(
  Object.keys(adapterRegistry) as ConnectionToolKind[],
);

export function getAdapter(kind: ConnectionToolKind): ToolAdapter {
  return adapterRegistry[kind];
}

export function listAdapters(): readonly ToolAdapter[] {
  return SUPPORTED_TOOL_KINDS.map((k) => adapterRegistry[k]);
}
