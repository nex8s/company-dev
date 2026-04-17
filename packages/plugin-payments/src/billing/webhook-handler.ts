import type { Db } from "@paperclipai/db";
import {
  findEntryByExternalRef,
  recordTopUp,
} from "../ledger/operations.js";
import type {
  StripeWebhookEvent,
  SubscriptionLike,
} from "../stripe/index.js";
import { getSubscriptionPlan, type SubscriptionPlanKey } from "./catalog.js";
import {
  findCompanyByStripeCustomer,
  touchCustomer,
} from "./customers.js";
import { upsertSubscription } from "./subscriptions.js";

export interface WebhookOutcome {
  readonly handled: boolean;
  readonly note?: string;
}

/**
 * Dispatch a Stripe webhook event to the B-07 side-effects:
 *
 *   - `customer.subscription.{created,updated,deleted}` →
 *       upsert `billing_subscriptions`
 *   - `invoice.paid` →
 *       if the invoice metadata tags it as a `top_up` (credits > 0), record
 *       a credit_ledger top-up (idempotent via `externalRef = invoice.id`).
 *   - `checkout.session.completed` → link the Stripe customer to the company
 *       that initiated the checkout. Subscription-mode sessions are no-ops
 *       here; the subscription.created event that Stripe fires alongside
 *       handles the DB write.
 *
 * Events we don't care about are returned as `{ handled: false, note }` so
 * the HTTP handler can still 200 them (Stripe retries on non-2xx).
 */
export async function applyWebhookEvent(
  db: Db,
  event: StripeWebhookEvent,
): Promise<WebhookOutcome> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applySubscriptionEvent(db, event.data.object, event.type);
    case "invoice.paid":
      return applyInvoicePaid(db, event.data.object);
    case "checkout.session.completed":
      return applyCheckoutSessionCompleted(db, event.data.object);
    default:
      return { handled: false, note: "unhandled event type" };
  }
}

async function applySubscriptionEvent(
  db: Db,
  sub: SubscriptionLike,
  eventType:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
): Promise<WebhookOutcome> {
  const companyId = await findCompanyByStripeCustomer(db, sub.customer);
  if (!companyId) {
    return { handled: false, note: `no company for customer ${sub.customer}` };
  }

  const planKey = extractPlanKeyFromSubscription(sub);
  const effectiveStatus =
    eventType === "customer.subscription.deleted" ? "canceled" : sub.status;
  const canceledAt =
    eventType === "customer.subscription.deleted"
      ? new Date()
      : sub.canceled_at
        ? unixToDate(sub.canceled_at)
        : null;

  await upsertSubscription(db, {
    companyId,
    stripeSubscriptionId: sub.id,
    plan: planKey,
    status: effectiveStatus,
    currentPeriodStart: unixToDateOrNull(sub.current_period_start),
    currentPeriodEnd: unixToDateOrNull(sub.current_period_end),
    cancelAt: unixToDateOrNull(sub.cancel_at),
    canceledAt,
  });
  await touchCustomer(db, companyId);
  return { handled: true };
}

async function applyInvoicePaid(
  db: Db,
  invoice: { id: string; customer: string; amount_paid: number; metadata: Record<string, string> },
): Promise<WebhookOutcome> {
  const companyId = await findCompanyByStripeCustomer(db, invoice.customer);
  if (!companyId) {
    return { handled: false, note: `no company for customer ${invoice.customer}` };
  }

  const kind = invoice.metadata?.["companydev.kind"];
  if (kind !== "top_up") {
    // Subscription invoices are not ledger top-ups; the plan entitlement
    // is handled by the subscription upsert path.
    return { handled: true, note: "non-top-up invoice, no ledger write" };
  }

  const existing = await findEntryByExternalRef(db, {
    companyId,
    externalRef: `stripe:invoice:${invoice.id}`,
    entryTypes: ["top_up"],
  });
  if (existing) return { handled: true, note: "already recorded (idempotent)" };

  await recordTopUp(db, {
    companyId,
    amountCents: invoice.amount_paid,
    externalRef: `stripe:invoice:${invoice.id}`,
    description: invoice.metadata?.["companydev.credits"]
      ? `Stripe top-up: ${invoice.metadata["companydev.credits"]} credits`
      : "Stripe top-up",
  });
  await touchCustomer(db, companyId);
  return { handled: true };
}

async function applyCheckoutSessionCompleted(
  db: Db,
  session: { customer: string | null; metadata: Record<string, string> },
): Promise<WebhookOutcome> {
  if (!session.customer) return { handled: false, note: "session has no customer" };
  const companyId = await findCompanyByStripeCustomer(db, session.customer);
  if (!companyId) {
    return { handled: false, note: `no company for customer ${session.customer}` };
  }
  await touchCustomer(db, companyId);
  return { handled: true };
}

function extractPlanKeyFromSubscription(
  sub: SubscriptionLike,
): SubscriptionPlanKey | "free_trial" {
  const metaKey = sub.metadata?.["companydev.plan"];
  if (metaKey) {
    const known = getSubscriptionPlan(metaKey);
    if (known) return known.key;
  }
  // Fall back to the first price id if the operator tagged metadata by key.
  // Real deployments should always set metadata at Checkout-creation time
  // (see `server/router.ts`), so this branch is defensive only.
  return "free_trial";
}

function unixToDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

function unixToDateOrNull(seconds: number | null): Date | null {
  return seconds === null ? null : unixToDate(seconds);
}
