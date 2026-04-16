import { randomUUID } from "node:crypto";
import type { SeedTemplate, StoreTemplateRecord, TemplateKind } from "./types.js";

export type ListTemplatesOptions = {
  category?: string;
  kind?: TemplateKind;
};

export interface StoreTemplatesRepository {
  loadSeeds(seeds: SeedTemplate[]): Promise<void>;
  list(opts?: ListTemplatesOptions): Promise<StoreTemplateRecord[]>;
  getBySlug(slug: string): Promise<StoreTemplateRecord | null>;
  count(): Promise<number>;
}

export class InMemoryStoreTemplatesRepository implements StoreTemplatesRepository {
  private readonly bySlug = new Map<string, StoreTemplateRecord>();

  async loadSeeds(seeds: SeedTemplate[]): Promise<void> {
    const now = new Date();
    for (const seed of seeds) {
      if (this.bySlug.has(seed.slug)) {
        throw new Error(`duplicate seed slug: ${seed.slug}`);
      }
      this.bySlug.set(seed.slug, {
        ...seed,
        id: randomUUID(),
        downloadCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async list(opts: ListTemplatesOptions = {}): Promise<StoreTemplateRecord[]> {
    const all = Array.from(this.bySlug.values());
    return all.filter((t) => {
      if (opts.category && t.category !== opts.category) return false;
      if (opts.kind && t.kind !== opts.kind) return false;
      return true;
    });
  }

  async getBySlug(slug: string): Promise<StoreTemplateRecord | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async count(): Promise<number> {
    return this.bySlug.size;
  }
}

export async function listTemplates(
  repo: StoreTemplatesRepository,
  opts?: ListTemplatesOptions,
): Promise<StoreTemplateRecord[]> {
  return repo.list(opts);
}
