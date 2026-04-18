import { api } from "./client";

/**
 * Typed client for B-14 plugin-connect-tools HTTP routes.
 * Mounted under `/api/companies/:companyId/plugin-connect-tools/...`.
 */

export type ConnectionToolKind = string;

export interface AdapterDto {
  readonly kind: ConnectionToolKind;
  readonly displayName: string;
  readonly homepageUrl: string | null;
  readonly defaultScopes: readonly string[];
}

export interface ConnectionDto {
  readonly id: string;
  readonly companyId: string;
  readonly toolKind: ConnectionToolKind;
  readonly label: string;
  readonly scopes: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly expiresAt: string | null;
  readonly connectedAt: string;
  readonly tokenLast4: string;
}

export interface CreateConnectionBody {
  readonly toolKind: ConnectionToolKind;
  readonly label: string;
  readonly token: string;
  readonly refreshToken?: string;
  readonly scopes?: readonly string[];
  readonly metadata?: Record<string, unknown>;
  readonly expiresAt?: string;
}

const base = (companyId: string) =>
  `/companies/${companyId}/plugin-connect-tools`;

export const pluginConnectToolsApi = {
  listAdapters: (companyId: string) =>
    api.get<{ adapters: readonly AdapterDto[] }>(`${base(companyId)}/adapters`),

  listConnections: (companyId: string) =>
    api.get<{ connections: readonly ConnectionDto[] }>(
      `${base(companyId)}/connections`,
    ),

  createConnection: (companyId: string, body: CreateConnectionBody) =>
    api.post<{ connection: ConnectionDto }>(
      `${base(companyId)}/connections`,
      body,
    ),

  deleteConnection: (companyId: string, connectionId: string) =>
    api.delete<void>(`${base(companyId)}/connections/${connectionId}`),
};
