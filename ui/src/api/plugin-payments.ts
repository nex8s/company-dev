import { api } from "./client";

/**
 * Typed client for `@paperclipai/plugin-payments` HTTP routes (B-07
 * Stripe integration). Mounted under `/api/companies/:companyId/plugin-payments/...`
 * — see `server/src/app.ts` and `packages/plugin-payments/src/server/router.ts`.
 *
 * Wire shapes mirror the router's catalog response + DTO transforms.
 * Stripe SDK types (`Stripe.Checkout.Session`, `Stripe.BillingPortal.Session`)
 * are not pulled into the UI bundle — the only field the UI cares about
 * is `url`, captured here as `CheckoutSessionLite`.
 */

export type SubscriptionPlanKey = "starter" | "pro";
export type TopUpCredits = 20 | 50 | 100 | 250;

export interface SubscriptionPlanCatalogEntry {
  readonly key: SubscriptionPlanKey;
  readonly displayName: string;
  readonly monthlyPriceCents: number;
  readonly priceConfigured: boolean;
}

export interface TopUpCatalogEntry {
  readonly credits: TopUpCredits;
  readonly amountCents: number;
  readonly priceConfigured: boolean;
}

export interface CatalogResponse {
  readonly plans: readonly SubscriptionPlanCatalogEntry[];
  readonly topUps: readonly TopUpCatalogEntry[];
}

export interface SubscriptionDto {
  readonly id: string;
  readonly plan: SubscriptionPlanKey;
  readonly status: string;
  readonly currentPeriodEnd: string | null;
  readonly cancelAt: string | null;
  readonly canceledAt: string | null;
}

/** The slice of `Stripe.Checkout.Session` the UI actually uses. */
export interface CheckoutSessionLite {
  readonly id: string;
  readonly url: string | null;
  readonly mode?: "subscription" | "payment";
}

export interface CreateSubscriptionCheckoutBody {
  readonly plan: SubscriptionPlanKey;
  readonly customerEmail?: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface CreateTopUpCheckoutBody {
  readonly credits: TopUpCredits;
  readonly customerEmail?: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

const base = (companyId: string) => `/companies/${companyId}/plugin-payments`;

export const pluginPaymentsApi = {
  getCatalog: (companyId: string) =>
    api.get<CatalogResponse>(`${base(companyId)}/catalog`),

  getSubscription: (companyId: string) =>
    api.get<{ subscription: SubscriptionDto | null }>(
      `${base(companyId)}/subscription`,
    ),

  createSubscriptionCheckout: (
    companyId: string,
    body: CreateSubscriptionCheckoutBody,
  ) =>
    api.post<{ checkout: CheckoutSessionLite }>(
      `${base(companyId)}/checkout/subscription`,
      body,
    ),

  createTopUpCheckout: (companyId: string, body: CreateTopUpCheckoutBody) =>
    api.post<{ checkout: CheckoutSessionLite }>(
      `${base(companyId)}/checkout/top-up`,
      body,
    ),

  createPortalSession: (companyId: string, returnUrl: string) =>
    api.post<{ portal: { url: string } }>(`${base(companyId)}/portal`, {
      returnUrl,
    }),
};
