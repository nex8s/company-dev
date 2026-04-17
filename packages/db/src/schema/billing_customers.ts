import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `billing_customers` — 1:1 mapping from `companies.id` to a Stripe customer
 * id (B-07). Owned by plugin-payments; lives in packages/db so drizzle-kit's
 * generator can pick it up.
 *
 * A company gets a row the first time it hits any billing endpoint that
 * needs a Stripe customer (checkout, portal). Subsequent calls reuse the
 * same `stripe_customer_id` so the Stripe dashboard stays 1:1 with our
 * company list.
 */
export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUq: uniqueIndex("billing_customers_company_uq").on(table.companyId),
    stripeCustomerUq: uniqueIndex("billing_customers_stripe_customer_uq").on(
      table.stripeCustomerId,
    ),
  }),
);
