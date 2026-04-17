/**
 * Plan + top-up catalog for B-07. Prices themselves live in Stripe; this
 * file is the source-of-truth for the *mapping* between plan keys, display
 * names, amounts, and the env var holding the Stripe price id.
 *
 * Env var lookups happen inside `resolvePriceId` so tests can stub them
 * directly on `process.env` and the server can refuse a checkout request
 * when the operator hasn't configured a price for that plan yet.
 */

export type SubscriptionPlanKey = "starter" | "pro";

export interface SubscriptionPlan {
  readonly key: SubscriptionPlanKey;
  readonly displayName: string;
  readonly monthlyPriceCents: number;
  readonly priceIdEnvVar: string;
}

export const SUBSCRIPTION_PLANS: Readonly<Record<SubscriptionPlanKey, SubscriptionPlan>> =
  Object.freeze({
    starter: {
      key: "starter",
      displayName: "Starter",
      monthlyPriceCents: 4900,
      priceIdEnvVar: "STRIPE_PRICE_STARTER",
    },
    pro: {
      key: "pro",
      displayName: "Pro",
      monthlyPriceCents: 14900,
      priceIdEnvVar: "STRIPE_PRICE_PRO",
    },
  });

export type TopUpCredits = 20 | 50 | 100 | 250;

export interface TopUpOption {
  readonly credits: TopUpCredits;
  readonly amountCents: number;
  readonly priceIdEnvVar: string;
}

export const TOP_UP_OPTIONS: readonly TopUpOption[] = Object.freeze([
  { credits: 20, amountCents: 2_000, priceIdEnvVar: "STRIPE_PRICE_TOPUP_20" },
  { credits: 50, amountCents: 4_500, priceIdEnvVar: "STRIPE_PRICE_TOPUP_50" },
  { credits: 100, amountCents: 8_500, priceIdEnvVar: "STRIPE_PRICE_TOPUP_100" },
  { credits: 250, amountCents: 20_000, priceIdEnvVar: "STRIPE_PRICE_TOPUP_250" },
]);

export function getSubscriptionPlan(key: string): SubscriptionPlan | null {
  if (!(key in SUBSCRIPTION_PLANS)) return null;
  return SUBSCRIPTION_PLANS[key as SubscriptionPlanKey];
}

export function getTopUpOption(credits: number): TopUpOption | null {
  return TOP_UP_OPTIONS.find((opt) => opt.credits === credits) ?? null;
}

/**
 * Resolve the Stripe price id for a plan or top-up by consulting the
 * appropriate env var. Returns null (caller decides whether to 400 or
 * 503) when the operator hasn't configured a price id for that entry.
 */
export function resolvePriceId(
  env: NodeJS.ProcessEnv,
  entry: { priceIdEnvVar: string },
): string | null {
  const v = env[entry.priceIdEnvVar];
  return v && v.length > 0 ? v : null;
}
