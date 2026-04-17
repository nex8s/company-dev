/**
 * Minimal Stripe surface used by plugin-payments (B-07). Keeps us off the
 * `stripe` npm package in the core module; the real wrapper lives behind
 * `StripeClient` and can be swapped for `MockStripeClient` in tests.
 */

export type StripeCheckoutMode = "subscription" | "payment";

export interface CreateCheckoutSessionInput {
  readonly mode: StripeCheckoutMode;
  readonly customerId?: string;
  readonly customerEmail?: string;
  readonly priceId: string;
  readonly quantity: number;
  readonly successUrl: string;
  readonly cancelUrl: string;
  /** Copied into Stripe's `Session.metadata` — used to route webhooks. */
  readonly metadata: Record<string, string>;
}

export interface CheckoutSession {
  readonly id: string;
  readonly url: string;
}

export interface CreateBillingPortalSessionInput {
  readonly customerId: string;
  readonly returnUrl: string;
}

export interface BillingPortalSession {
  readonly url: string;
}

export interface CreateCustomerInput {
  readonly email?: string;
  readonly metadata: Record<string, string>;
}

export interface StripeCustomer {
  readonly id: string;
}

export interface VerifyWebhookInput {
  readonly rawBody: Buffer | string;
  readonly signature: string;
  readonly secret: string;
}

/**
 * Shape of the Stripe webhook events plugin-payments actually handles.
 * Trimmed to just the fields our handler reads so the Mock doesn't need
 * to fabricate the entire `Stripe.Event` tree.
 */
export type StripeWebhookEvent =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionDeletedEvent
  | InvoicePaidEvent
  | CheckoutSessionCompletedEvent;

export interface SubscriptionLike {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly current_period_start: number | null;
  readonly current_period_end: number | null;
  readonly cancel_at: number | null;
  readonly canceled_at: number | null;
  readonly items: { readonly data: Array<{ readonly price: { readonly id: string } }> };
  readonly metadata: Record<string, string>;
}

export interface InvoiceLike {
  readonly id: string;
  readonly customer: string;
  readonly subscription: string | null;
  readonly amount_paid: number;
  readonly currency: string;
  readonly status: string;
  readonly metadata: Record<string, string>;
}

export interface CheckoutSessionLike {
  readonly id: string;
  readonly customer: string | null;
  readonly customer_email: string | null;
  readonly mode: StripeCheckoutMode;
  readonly payment_status: string;
  readonly amount_total: number | null;
  readonly currency: string | null;
  readonly metadata: Record<string, string>;
  readonly subscription: string | null;
}

export interface SubscriptionCreatedEvent {
  readonly id: string;
  readonly type: "customer.subscription.created";
  readonly data: { readonly object: SubscriptionLike };
}
export interface SubscriptionUpdatedEvent {
  readonly id: string;
  readonly type: "customer.subscription.updated";
  readonly data: { readonly object: SubscriptionLike };
}
export interface SubscriptionDeletedEvent {
  readonly id: string;
  readonly type: "customer.subscription.deleted";
  readonly data: { readonly object: SubscriptionLike };
}
export interface InvoicePaidEvent {
  readonly id: string;
  readonly type: "invoice.paid";
  readonly data: { readonly object: InvoiceLike };
}
export interface CheckoutSessionCompletedEvent {
  readonly id: string;
  readonly type: "checkout.session.completed";
  readonly data: { readonly object: CheckoutSessionLike };
}

/** Thrown by `verifyWebhookSignature` when the signature header is wrong. */
export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

export interface StripeClient {
  createCustomer(input: CreateCustomerInput): Promise<StripeCustomer>;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
  createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<BillingPortalSession>;
  /**
   * Verifies the Stripe signature header against the raw request body and
   * returns the parsed event. Throws `StripeSignatureError` on mismatch.
   */
  verifyWebhookSignature(input: VerifyWebhookInput): StripeWebhookEvent;
}
