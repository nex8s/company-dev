export type LegalEntityStatus = "pending" | "active" | "failed" | "stub";
export type LegalEntityType = "LLC" | "C-Corp" | "Stub";

export type LegalEntityDocument = {
  kind: string;
  url: string;
};

export type LegalEntity = {
  entityId: string;
  companyId: string;
  name: string;
  entityType: LegalEntityType;
  jurisdiction: string;
  status: LegalEntityStatus;
  documents: LegalEntityDocument[];
  estimatedCostUsd: number;
  founderEmail: string;
  createdAt: Date;
};

export type CreateLegalEntityInput = {
  companyId: string;
  name: string;
  state?: string;
  founderEmail: string;
  idempotencyKey?: string;
};

export type CreateLegalEntityResult = {
  entityId: string;
  entityType: LegalEntityType;
  jurisdiction: string;
  status: LegalEntityStatus;
  documents: LegalEntityDocument[];
  estimatedCostUsd: number;
};

export type DissolveResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface IdentityProvider {
  createLegalEntity(input: CreateLegalEntityInput): Promise<CreateLegalEntityResult>;
  getLegalEntity(entityId: string): Promise<LegalEntity | null>;
  listForCompany(companyId: string): Promise<LegalEntity[]>;
  dissolveLegalEntity(entityId: string): Promise<DissolveResult>;
}
