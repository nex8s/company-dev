/**
 * Upgrade page + Top-up modal copy (C-11). Wired to plugin-payments
 * via `pluginPaymentsApi` (B-07).
 */

export const payments = {
  upgrade: {
    backCta: "Back",
    heading: "Choose your plan",
    subheading:
      "Access the most powerful AI workforce. Scale intelligently as you demand more capacity.",
    trialBanner: (daysLeft: number) =>
      daysLeft === 1
        ? "You're on a free trial — 1 day left"
        : `You're on a free trial — ${daysLeft} days left`,
    error: "Couldn't load the plan catalog.",
    free: {
      title: "Free",
      blurb: "Explore the platform with a time-limited trial.",
      price: "Limited",
      currentBadge: "Current",
      currentCta: "Current plan",
    },
    plan: {
      starterBlurb: "For individuals and small teams getting started.",
      proBlurb: "For teams that need advanced features and more power.",
      perMonth: "/mo",
      subscribeCta: "Subscribe",
      subscribingCta: "Redirecting…",
      missingPriceTooltip: (envVar: string) =>
        `Stripe price not configured (set ${envVar})`,
      checkoutFailed: "Couldn't start the Stripe checkout.",
    },
    payg: {
      heading: "Pay as you go",
      blurb: "Top up anytime. Credits never expire.",
      currentBalanceLabel: "Current balance",
      topUpCta: "Top Up Credits",
    },
  },
  topUp: {
    title: "Top Up Credits",
    closeLabel: "Close top-up modal",
    currentBalance: (credits: number) =>
      `Current balance: ${credits.toFixed(2)} credits`,
    creditsSuffix: "Credits",
    popularBadge: "Popular",
    bestValueBadge: "Best Value",
    youReceive: (credits: number, dollars: string) =>
      `You'll receive ${credits} credits for $${dollars}`,
    newBalance: (next: number) =>
      `New balance after purchase: ${next.toFixed(2)}`,
    securedByStripe: "Secured by Stripe",
    cancelCta: "Cancel",
    purchaseCta: "Purchase Credits",
    purchasingCta: "Redirecting…",
    error: "Couldn't load top-up options.",
    checkoutFailed: "Couldn't start the Stripe checkout.",
  },
} as const;

export type PaymentsCopy = typeof payments;
