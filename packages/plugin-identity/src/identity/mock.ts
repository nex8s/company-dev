import { randomUUID } from "node:crypto";
import type {
  CreateLegalEntityInput,
  CreateLegalEntityResult,
  DissolveResult,
  IdentityProvider,
  LegalEntity,
} from "./provider.js";

export type MockIdentityLogEvent = {
  intent: "createLegalEntity" | "dissolveLegalEntity";
  at: Date;
  payload: unknown;
};

export type MockIdentityProviderOptions = {
  /** Receives a structured log event for every write. Defaults to a no-op. */
  log?: (event: MockIdentityLogEvent) => void;
  /** Override the default jurisdiction returned by the stub. */
  defaultJurisdiction?: string;
};

export class MockIdentityProvider implements IdentityProvider {
  private readonly byEntityId = new Map<string, LegalEntity>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly log: (event: MockIdentityLogEvent) => void;
  private readonly defaultJurisdiction: string;

  constructor(opts: MockIdentityProviderOptions = {}) {
    this.log = opts.log ?? (() => {});
    this.defaultJurisdiction = opts.defaultJurisdiction ?? "Delaware";
  }

  async createLegalEntity(input: CreateLegalEntityInput): Promise<CreateLegalEntityResult> {
    if (input.idempotencyKey) {
      const prior = this.byIdempotencyKey.get(input.idempotencyKey);
      if (prior) {
        const existing = this.byEntityId.get(prior);
        if (existing) {
          return this.toCreateResult(existing);
        }
      }
    }

    const entityId = `stub-${randomUUID()}`;
    const entity: LegalEntity = {
      entityId,
      companyId: input.companyId,
      name: input.name,
      entityType: "Stub",
      jurisdiction: input.state ?? this.defaultJurisdiction,
      status: "stub",
      documents: [],
      estimatedCostUsd: 0,
      founderEmail: input.founderEmail,
      createdAt: new Date(),
    };

    this.byEntityId.set(entityId, entity);
    if (input.idempotencyKey) {
      this.byIdempotencyKey.set(input.idempotencyKey, entityId);
    }

    this.log({ intent: "createLegalEntity", at: new Date(), payload: input });
    return this.toCreateResult(entity);
  }

  async getLegalEntity(entityId: string): Promise<LegalEntity | null> {
    return this.byEntityId.get(entityId) ?? null;
  }

  async listForCompany(companyId: string): Promise<LegalEntity[]> {
    return Array.from(this.byEntityId.values()).filter((e) => e.companyId === companyId);
  }

  async dissolveLegalEntity(entityId: string): Promise<DissolveResult> {
    const entity = this.byEntityId.get(entityId);
    if (!entity) {
      return { ok: false, reason: `entity not found: ${entityId}` };
    }
    this.byEntityId.delete(entityId);
    this.log({ intent: "dissolveLegalEntity", at: new Date(), payload: { entityId } });
    return { ok: true };
  }

  private toCreateResult(entity: LegalEntity): CreateLegalEntityResult {
    return {
      entityId: entity.entityId,
      entityType: entity.entityType,
      jurisdiction: entity.jurisdiction,
      status: entity.status,
      documents: entity.documents,
      estimatedCostUsd: entity.estimatedCostUsd,
    };
  }
}
