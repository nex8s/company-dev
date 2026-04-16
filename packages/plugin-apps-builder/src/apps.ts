import { randomUUID } from "node:crypto";

export type AppRecord = {
  id: string;
  companyId: string;
  name: string;
  channelId: string | null;
  connections: unknown[];
  envVars: Record<string, string>;
  productionDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAppInput = {
  companyId: string;
  name: string;
  channelId?: string | null;
  connections?: unknown[];
  envVars?: Record<string, string>;
  productionDomain?: string | null;
};

export interface AppsRepository {
  create(input: CreateAppInput): Promise<AppRecord>;
  get(id: string): Promise<AppRecord | null>;
  attachChannel(id: string, channelId: string): Promise<AppRecord>;
}

export class InMemoryAppsRepository implements AppsRepository {
  private readonly store = new Map<string, AppRecord>();

  async create(input: CreateAppInput): Promise<AppRecord> {
    const now = new Date();
    const record: AppRecord = {
      id: randomUUID(),
      companyId: input.companyId,
      name: input.name,
      channelId: input.channelId ?? null,
      connections: input.connections ?? [],
      envVars: input.envVars ?? {},
      productionDomain: input.productionDomain ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, record);
    return record;
  }

  async get(id: string): Promise<AppRecord | null> {
    return this.store.get(id) ?? null;
  }

  async attachChannel(id: string, channelId: string): Promise<AppRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`app not found: ${id}`);
    const updated: AppRecord = { ...existing, channelId, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }
}
