import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `billing_subscriptions` — B-07. One row per company that currently holds
 * (or has ever held) a paid subscription. The Stripe webhook handler upserts
 * here on `customer.subscription.{created,updated,deleted}`.
 *
 * `plan` values: `free_trial` | `starter` | `pro`.
 * `status` values: follow Stripe's subscription status enum
 *   (`active` | `past_due` | `canceled` | `incomplete` | `trialing` | `unpaid` | `paused`).
 *
 * `(company_id)` is UNIQUE because Phase-1 allows at most one active plan
 * per company; a future shift to multiple concurrent subscriptions (e.g.
 * marketplace add-ons) will relax this.
 */
export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAt: timestamp("cancel_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("billing_subscriptions_company_uq").on(table.companyId),
    stripeSubUq: uniqueIndex("billing_subscriptions_stripe_sub_uq").on(
      table.stripeSubscriptionId,
    ),
    statusIdx: index("billing_subscriptions_status_idx").on(table.status),
  }),
);
