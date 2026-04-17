import { randomUUID } from "node:crypto";
import type {
  BillingPortalSession,
  CheckoutSession,
  CreateBillingPortalSessionInput,
  CreateCheckoutSessionInput,
  CreateCustomerInput,
  StripeClient,
  StripeCustomer,
  StripeWebhookEvent,
  VerifyWebhookInput,
} from "./types.js";
import { StripeSignatureError } from "./types.js";

export interface MockStripeLogEvent {
  intent: "createCustomer" | "createCheckoutSession" | "createBillingPortalSession";
  at: Date;
  payload: unknown;
}

export interface MockStripeOptions {
  readonly log?: (event: MockStripeLogEvent) => void;
  /** Signature the Mock accepts on webhook verification. Defaults to "t=1,v1=mock". */
  readonly webhookSignature?: string;
  /** Secret the Mock treats as valid. Defaults to "whsec_mock". */
  readonly webhookSecret?: string;
}

/**
 * In-memory Stripe stand-in. No network calls. Use in dev (no
 * `STRIPE_SECRET_KEY`) and in tests:
 *   - `createCustomer` returns `cus_mock_<uuid>`
 *   - `createCheckoutSession` returns `cs_mock_<uuid>` with a stub URL
 *     containing the metadata so tests can assert what got handed off
 *   - `verifyWebhookSignature` accepts only the configured signature +
 *     secret, returning the `event` embedded in the raw body as JSON.
 *     The raw body must be a JSON string representing a `StripeWebhookEvent`.
 */
export class MockStripeClient implements StripeClient {
  private readonly log: (event: MockStripeLogEvent) => void;
  private readonly webhookSignature: string;
  private readonly webhookSecret: string;

  constructor(opts: MockStripeOptions = {}) {
    this.log = opts.log ?? (() => {});
    this.webhookSignature = opts.webhookSignature ?? "t=1,v1=mock";
    this.webhookSecret = opts.webhookSecret ?? "whsec_mock";
  }

  async createCustomer(input: CreateCustomerInput): Promise<StripeCustomer> {
    const id = `cus_mock_${randomUUID()}`;
    this.log({ intent: "createCustomer", at: new Date(), payload: input });
    return { id };
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    const id = `cs_mock_${randomUUID()}`;
    const url = `https://checkout.stripe.mock/session/${id}?price=${encodeURIComponent(input.priceId)}`;
    this.log({ intent: "createCheckoutSession", at: new Date(), payload: input });
    return { id, url };
  }

  async createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<BillingPortalSession> {
    const url = `https://billing.stripe.mock/portal/${input.customerId}?return=${encodeURIComponent(input.returnUrl)}`;
    this.log({ intent: "createBillingPortalSession", at: new Date(), payload: input });
    return { url };
  }

  /**
   * Mock signature scheme: the signature header must equal the configured
   * value, AND the secret passed in must equal the configured one. Raw body
   * is expected to be JSON-encoded `StripeWebhookEvent`.
   */
  verifyWebhookSignature(input: VerifyWebhookInput): StripeWebhookEvent {
    if (input.secret !== this.webhookSecret) {
      throw new StripeSignatureError("invalid webhook secret (mock)");
    }
    if (input.signature !== this.webhookSignature) {
      throw new StripeSignatureError("invalid signature header (mock)");
    }
    const asString =
      typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");
    try {
      return JSON.parse(asString) as StripeWebhookEvent;
    } catch {
      throw new StripeSignatureError("raw body is not valid JSON (mock)");
    }
  }
}
