import { billingCustomers, billingSubscriptions, creditLedger } from "@paperclipai/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export { creditLedger, billingCustomers, billingSubscriptions };

export type CreditLedgerEntry = InferSelectModel<typeof creditLedger>;
export type NewCreditLedgerEntry = InferInsertModel<typeof creditLedger>;
export type BillingCustomer = InferSelectModel<typeof billingCustomers>;
export type NewBillingCustomer = InferInsertModel<typeof billingCustomers>;
export type BillingSubscription = InferSelectModel<typeof billingSubscriptions>;
export type NewBillingSubscription = InferInsertModel<typeof billingSubscriptions>;

/**
 * Discriminator for `credit_ledger.entry_type`. Balance computation:
 *   balance = sum(top_up + adjustment + rollover) - sum(usage)
 *
 * `usage` is the only debit type. `adjustment` may represent either grants or
 * clawbacks (positive amount with a description either way); the operator who
 * wrote the adjustment is responsible for the sign convention via description.
 */
export const CREDIT_LEDGER_ENTRY_TYPES = [
  "top_up",
  "usage",
  "rollover",
  "adjustment",
] as const;
export type CreditLedgerEntryType = (typeof CREDIT_LEDGER_ENTRY_TYPES)[number];
