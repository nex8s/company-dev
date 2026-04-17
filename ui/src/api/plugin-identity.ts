import { api } from "./client";

/**
 * Typed client for `@paperclipai/plugin-identity` HTTP routes
 * (server/src/routes/plugin-identity.ts → packages/plugin-identity/src/server/router.ts).
 *
 * As of B-13, the only provider methods routed over HTTP are bank cards
 * and company domains. EmailProvider / BrowserProvider / IdentityProvider
 * have full mock implementations in-repo but no HTTP endpoints yet — the
 * C-09 tabs that depend on them render typed stubs flagged with the
 * matching B-task. See `ui/src/hooks/useEmployeeDetailData.ts` for the
 * swap points.
 */

// Mirrors `toCardDto` in plugin-identity router.ts.
export interface VirtualCardDto {
  readonly cardId: string;
  readonly accountId: string;
  readonly ownerAgentId: string;
  readonly pan: string;
  readonly last4: string;
  readonly spendingLimitUsd: number | null;
  readonly spentUsd: number;
  readonly merchantCategoryFilters: readonly string[];
  readonly status: "active" | "frozen" | "closed";
  readonly createdAt: string;
}

export interface ListAgentCardsResponse {
  readonly cards: readonly VirtualCardDto[];
}

export interface IssueCardBody {
  readonly spendingLimitUsd?: number | null;
  readonly merchantCategoryFilters?: readonly string[];
  readonly idempotencyKey?: string;
}

export interface IssueCardResponse {
  readonly card: VirtualCardDto;
}

export const pluginIdentityApi = {
  listAgentCards: (companyId: string, agentId: string) =>
    api.get<ListAgentCardsResponse>(
      `/companies/${companyId}/plugin-identity/agents/${agentId}/cards`,
    ),

  issueAgentCard: (companyId: string, agentId: string, body: IssueCardBody = {}) =>
    api.post<IssueCardResponse>(
      `/companies/${companyId}/plugin-identity/agents/${agentId}/cards`,
      body,
    ),

  freezeAgentCard: (companyId: string, agentId: string, cardId: string) =>
    api.post<IssueCardResponse>(
      `/companies/${companyId}/plugin-identity/agents/${agentId}/cards/${cardId}/freeze`,
      {},
    ),
};
