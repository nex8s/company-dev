import { and, desc, eq } from "drizzle-orm";
import { type Db, connections } from "@paperclipai/db";
import type { InferSelectModel } from "drizzle-orm";
import type { ConnectionToolKind } from "../adapters/types.js";

export type ConnectionRow = InferSelectModel<typeof connections>;

export interface StoreConnectionInput {
  companyId: string;
  toolKind: ConnectionToolKind;
  label: string;
  token: string;
  refreshToken?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

/**
 * Insert a new connection row. The `(company_id, tool_kind, label)` unique
 * index in the schema means re-using the same label for the same tool in the
 * same company is a constraint violation — callers should pick a stable label
 * (e.g. the workspace name from the OAuth response) per connection.
 */
export async function storeConnection(
  db: Db,
  input: StoreConnectionInput,
): Promise<ConnectionRow> {
  const [row] = await db
    .insert(connections)
    .values({
      companyId: input.companyId,
      toolKind: input.toolKind,
      label: input.label,
      token: input.token,
      refreshToken: input.refreshToken ?? null,
      scopes: input.scopes ?? [],
      metadata: input.metadata ?? {},
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return row!;
}

/** All connections for a company, newest-first. */
export async function listConnections(
  db: Db,
  companyId: string,
): Promise<ConnectionRow[]> {
  return db
    .select()
    .from(connections)
    .where(eq(connections.companyId, companyId))
    .orderBy(desc(connections.connectedAt));
}

/** Connections for a company filtered to a single tool kind. */
export async function listConnectionsByKind(
  db: Db,
  companyId: string,
  toolKind: ConnectionToolKind,
): Promise<ConnectionRow[]> {
  return db
    .select()
    .from(connections)
    .where(and(eq(connections.companyId, companyId), eq(connections.toolKind, toolKind)))
    .orderBy(desc(connections.connectedAt));
}

export async function getConnection(
  db: Db,
  companyId: string,
  connectionId: string,
): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.companyId, companyId), eq(connections.id, connectionId)))
    .limit(1);
  return row ?? null;
}

export async function deleteConnection(
  db: Db,
  companyId: string,
  connectionId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(connections)
    .where(and(eq(connections.companyId, companyId), eq(connections.id, connectionId)))
    .returning({ id: connections.id });
  return deleted.length > 0;
}
