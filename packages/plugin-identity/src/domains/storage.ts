import { and, asc, eq, sql } from "drizzle-orm";
import { type Db, domains } from "@paperclipai/db";
import type { InferSelectModel } from "drizzle-orm";
import type {
  DomainRegistration,
  DomainRegistrationStatus,
  EmailProvider,
} from "../email/index.js";

export type DomainRow = InferSelectModel<typeof domains>;

export interface CreateDomainInput {
  companyId: string;
  domain: string;
}

/**
 * Add a domain to a company. The first domain stored for a company is
 * automatically marked `isDefault: true`; subsequent calls store it as
 * `false`. The EmailProvider is consulted for DNS records — Mock returns
 * static CNAME+TXT stubs (B-11), real providers (Resend / Postmark) will
 * return their actual verification records.
 */
export async function createDomain(
  db: Db,
  emailProvider: EmailProvider,
  input: CreateDomainInput,
): Promise<DomainRow> {
  const registration: DomainRegistration = await emailProvider.registerCustomDomain({
    companyId: input.companyId,
    domain: input.domain,
  });

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.companyId, input.companyId))
      .limit(1);

    const isFirst = existing.length === 0;

    const [row] = await tx
      .insert(domains)
      .values({
        companyId: input.companyId,
        domain: input.domain,
        isDefault: isFirst,
        status: registration.status as DomainRegistrationStatus,
        dnsRecords: registration.dnsRecords,
      })
      .returning();
    return row!;
  });
}

export async function listDomains(db: Db, companyId: string): Promise<DomainRow[]> {
  return db
    .select()
    .from(domains)
    .where(eq(domains.companyId, companyId))
    .orderBy(asc(domains.registeredAt));
}

export async function getDomain(
  db: Db,
  companyId: string,
  domainId: string,
): Promise<DomainRow | null> {
  const [row] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.companyId, companyId), eq(domains.id, domainId)))
    .limit(1);
  return row ?? null;
}

/**
 * Mark `domainId` as the company's default. Clears the `is_default` flag on
 * every other domain in the same company in the same transaction so the
 * "at most one default per company" invariant holds.
 */
export async function setDefaultDomain(
  db: Db,
  companyId: string,
  domainId: string,
): Promise<DomainRow | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(domains)
      .where(and(eq(domains.companyId, companyId), eq(domains.id, domainId)))
      .limit(1);
    if (!target) return null;

    await tx
      .update(domains)
      .set({ isDefault: false })
      .where(and(eq(domains.companyId, companyId), sql`${domains.id} <> ${domainId}`));

    const [updated] = await tx
      .update(domains)
      .set({ isDefault: true })
      .where(eq(domains.id, domainId))
      .returning();
    return updated ?? null;
  });
}

export async function deleteDomain(
  db: Db,
  companyId: string,
  domainId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(domains)
    .where(and(eq(domains.companyId, companyId), eq(domains.id, domainId)))
    .returning({ id: domains.id });
  return deleted.length > 0;
}
