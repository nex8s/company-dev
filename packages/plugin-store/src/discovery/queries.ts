import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { storeTemplates, type StoreTemplateRow } from "../schema.js";
import type { TemplateKind } from "../types.js";

/**
 * Discovery (B-06) — DB-backed listing + faceting on top of the
 * `store_templates` table A-10 writes to. Reads are global (the store is a
 * marketplace, not company-scoped); write paths still live in plugin-company's
 * `store-publishing/publisher.ts`.
 */

export interface ListPublishedTemplatesInput {
  /** Filter to a single kind. Omit to include both. */
  readonly kind?: TemplateKind;
  /** Filter to a single category (case-sensitive match against the column). */
  readonly category?: string;
  /** Free-text search; matched case-insensitively against title + summary. */
  readonly q?: string;
  /** 1–100. Defaults to 20. */
  readonly limit?: number;
  /** Defaults to 0. */
  readonly offset?: number;
}

export interface ListPublishedTemplatesResult {
  readonly templates: StoreTemplateRow[];
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    /** Total rows matching the filter, ignoring limit/offset. */
    readonly total: number;
  };
}

export async function listPublishedTemplates(
  db: Db,
  input: ListPublishedTemplatesInput = {},
): Promise<ListPublishedTemplatesResult> {
  const limit = clamp(input.limit ?? 20, 1, 100);
  const offset = Math.max(0, input.offset ?? 0);
  const where = buildWhere(input);

  const [templates, totalRow] = await Promise.all([
    where
      ? db
          .select()
          .from(storeTemplates)
          .where(where)
          .orderBy(desc(storeTemplates.createdAt), asc(storeTemplates.id))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(storeTemplates)
          .orderBy(desc(storeTemplates.createdAt), asc(storeTemplates.id))
          .limit(limit)
          .offset(offset),
    where
      ? db
          .select({ total: sql<string>`count(*)` })
          .from(storeTemplates)
          .where(where)
      : db.select({ total: sql<string>`count(*)` }).from(storeTemplates),
  ]);

  return {
    templates,
    pagination: { limit, offset, total: Number(totalRow[0]?.total ?? 0) },
  };
}

export interface CategoryFacet {
  readonly category: string;
  readonly count: number;
}

export interface KindFacet {
  readonly kind: TemplateKind;
  readonly count: number;
}

export interface StoreFacets {
  readonly categories: CategoryFacet[];
  readonly kinds: KindFacet[];
  readonly total: number;
}

/**
 * Per-category + per-kind counts for the Store browser sidebar. Computed
 * server-side so every page render gets a single round-trip.
 */
export async function getStoreFacets(db: Db): Promise<StoreFacets> {
  const [categoryRows, kindRows, totalRow] = await Promise.all([
    db
      .select({
        category: storeTemplates.category,
        count: sql<string>`count(*)`,
      })
      .from(storeTemplates)
      .groupBy(storeTemplates.category)
      .orderBy(asc(storeTemplates.category)),
    db
      .select({
        kind: storeTemplates.kind,
        count: sql<string>`count(*)`,
      })
      .from(storeTemplates)
      .groupBy(storeTemplates.kind)
      .orderBy(asc(storeTemplates.kind)),
    db.select({ total: sql<string>`count(*)` }).from(storeTemplates),
  ]);

  return {
    categories: categoryRows.map((r) => ({ category: r.category, count: Number(r.count) })),
    kinds: kindRows.map((r) => ({
      kind: r.kind as TemplateKind,
      count: Number(r.count),
    })),
    total: Number(totalRow[0]?.total ?? 0),
  };
}

export async function getPublishedTemplateBySlug(
  db: Db,
  slug: string,
): Promise<StoreTemplateRow | null> {
  const [row] = await db
    .select()
    .from(storeTemplates)
    .where(eq(storeTemplates.slug, slug))
    .limit(1);
  return row ?? null;
}

function buildWhere(input: ListPublishedTemplatesInput): SQL | undefined {
  const conds: SQL[] = [];
  if (input.kind) conds.push(eq(storeTemplates.kind, input.kind));
  if (input.category) conds.push(eq(storeTemplates.category, input.category));
  if (input.q && input.q.trim().length > 0) {
    const needle = `%${input.q.trim()}%`;
    const orExpr = or(
      ilike(storeTemplates.title, needle),
      ilike(storeTemplates.summary, needle),
    );
    if (orExpr) conds.push(orExpr);
  }
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : and(...conds);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
