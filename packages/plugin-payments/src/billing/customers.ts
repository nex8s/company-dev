import { and, eq, sql } from "drizzle-orm";
import { billingCustomers, type Db } from "@paperclipai/db";
import type { InferSelectModel } from "drizzle-orm";
import type { StripeClient } from "../stripe/index.js";

export type BillingCustomerRow = InferSelectModel<typeof billingCustomers>;

/**
 * Find the Stripe customer id for a company, creating one via Stripe if
 * none exists. Idempotent per `(companyId)` — the unique index on
 * `billing_customers.company_id` prevents races.
 */
export async function ensureStripeCustomerId(
  db: Db,
  stripe: StripeClient,
  input: { companyId: string; email?: string },
): Promise<string> {
  const [existing] = await db
    .select()
    .from(billingCustomers)
    .where(eq(billingCustomers.companyId, input.companyId))
    .limit(1);
  if (existing) return existing.stripeCustomerId;

  const customer = await stripe.createCustomer({
    email: input.email,
    metadata: { companyId: input.companyId },
  });

  try {
    await db.insert(billingCustomers).values({
      companyId: input.companyId,
      stripeCustomerId: customer.id,
    });
  } catch (err) {
    // Race: another request may have inserted a row between select and insert.
    // In that case re-read and use the winning row's stripe id.
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      const [winner] = await db
        .select()
        .from(billingCustomers)
        .where(eq(billingCustomers.companyId, input.companyId))
        .limit(1);
      if (winner) return winner.stripeCustomerId;
    }
    throw err;
  }

  return customer.id;
}

/** Reverse lookup: find the company that owns a given Stripe customer. */
export async function findCompanyByStripeCustomer(
  db: Db,
  stripeCustomerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ companyId: billingCustomers.companyId })
    .from(billingCustomers)
    .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row?.companyId ?? null;
}

/** Last-touched-at bump for webhook audit (not yet surfaced in the UI). */
export async function touchCustomer(db: Db, companyId: string): Promise<void> {
  await db
    .update(billingCustomers)
    .set({ updatedAt: sql`now()` })
    .where(and(eq(billingCustomers.companyId, companyId)));
}
