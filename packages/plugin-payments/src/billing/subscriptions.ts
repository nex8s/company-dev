import { eq, sql } from "drizzle-orm";
import { billingSubscriptions, type Db } from "@paperclipai/db";
import type { InferSelectModel } from "drizzle-orm";
import type { SubscriptionPlanKey } from "./catalog.js";

export type BillingSubscriptionRow = InferSelectModel<typeof billingSubscriptions>;

export interface UpsertSubscriptionInput {
  readonly companyId: string;
  readonly stripeSubscriptionId: string;
  readonly plan: SubscriptionPlanKey | "free_trial";
  readonly status: string;
  readonly currentPeriodStart: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly cancelAt: Date | null;
  readonly canceledAt: Date | null;
}

/**
 * Upsert the single current subscription row for a company. Driven by the
 * Stripe webhook handler on `customer.subscription.{created,updated,deleted}`.
 * `deleted` events still arrive here so `status` ends up at `canceled` and
 * `canceledAt` is set — downstream reads use the row to render "Canceled
 * on <date>" in the Settings UI.
 */
export async function upsertSubscription(
  db: Db,
  input: UpsertSubscriptionInput,
): Promise<BillingSubscriptionRow> {
  const values = {
    companyId: input.companyId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    plan: input.plan,
    status: input.status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAt: input.cancelAt,
    canceledAt: input.canceledAt,
  };
  const [row] = await db
    .insert(billingSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: billingSubscriptions.companyId,
      set: {
        stripeSubscriptionId: values.stripeSubscriptionId,
        plan: values.plan,
        status: values.status,
        currentPeriodStart: values.currentPeriodStart,
        currentPeriodEnd: values.currentPeriodEnd,
        cancelAt: values.cancelAt,
        canceledAt: values.canceledAt,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row!;
}

export async function getSubscriptionForCompany(
  db: Db,
  companyId: string,
): Promise<BillingSubscriptionRow | null> {
  const [row] = await db
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.companyId, companyId))
    .limit(1);
  return row ?? null;
}
