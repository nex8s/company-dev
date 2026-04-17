import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, Coins, Plus } from "lucide-react";
import { useNavigate, useParams } from "@/lib/router";
import { ApiError } from "@/api/client";
import {
  pluginPaymentsApi,
  type SubscriptionPlanCatalogEntry,
  type SubscriptionPlanKey,
} from "@/api/plugin-payments";
import { payments as copy } from "@/copy/payments";
import { queryKeys } from "@/lib/queryKeys";
import { useCompanyShellData } from "@/hooks/useCompanyShellData";
import { TopUpModal } from "./TopUpModal";

/**
 * C-11 Upgrade page — sibling top-level view at `/c/:companyId/upgrade`.
 * Reads the plugin-payments catalog (B-07), redirects through Stripe
 * Checkout when a Subscribe button is clicked. Trial banner pulls the
 * trial-days-left from the existing CompanyShell data.
 *
 * Top-up modal is rendered inline, opened from the "Pay as you go" card.
 * The same modal can be triggered elsewhere later (e.g. the user-menu
 * "Top Up Credits" item) by lifting the open state.
 */

const PLAN_FEATURES: Readonly<Record<SubscriptionPlanKey, readonly string[]>> = {
  starter: [
    "AI agents",
    "5 product subdomains",
    "Unlimited collaborators",
    "On-demand credit top-ups",
    "Credit rollovers",
    "Custom domains",
    "50 monthly credits",
  ],
  pro: [
    "Everything in Starter",
    "Internal publish",
    "Design templates",
    "Security center",
    "Role-based access",
    "SSO",
    "Team workspace",
    "200 monthly credits",
  ],
};

export function Upgrade() {
  const navigate = useNavigate();
  const { companyId = "" } = useParams<{ companyId: string }>();
  const shell = useCompanyShellData(companyId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const catalogQuery = useQuery({
    queryKey: queryKeys.pluginPayments.catalog(companyId),
    queryFn: () => pluginPaymentsApi.getCatalog(companyId),
    enabled: companyId.length > 0,
  });

  const subscriptionQuery = useQuery({
    queryKey: queryKeys.pluginPayments.subscription(companyId),
    queryFn: () => pluginPaymentsApi.getSubscription(companyId),
    enabled: companyId.length > 0,
  });

  const checkoutMutation = useMutation<
    string,
    ApiError,
    { plan: SubscriptionPlanKey }
  >({
    mutationFn: async ({ plan }) => {
      const origin = window.location.origin;
      const response = await pluginPaymentsApi.createSubscriptionCheckout(
        companyId,
        {
          plan,
          successUrl: `${origin}/c/${companyId}?stripe=success`,
          cancelUrl: `${origin}/c/${companyId}/upgrade?stripe=canceled`,
        },
      );
      const url = response.checkout.url;
      if (!url) throw new ApiError("checkout url missing", 502, response);
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  return (
    <div
      data-testid="upgrade-view"
      className="flex-1 overflow-y-auto bg-cream/40"
    >
      <Header companyId={companyId} navigate={navigate} />
      <div className="flex flex-col items-center mt-10 mb-20 px-6 max-w-5xl mx-auto">
        <h1 className="text-4xl mb-3 text-center">{copy.upgrade.heading}</h1>
        <p className="text-mist max-w-md text-center mb-8">
          {copy.upgrade.subheading}
        </p>

        {shell.company.trialState === "trial" && (
          <div
            data-testid="trial-banner"
            className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-4 py-1.5 rounded-full mb-10 shadow-sm"
          >
            {copy.upgrade.trialBanner(shell.company.trialDaysLeft)}
          </div>
        )}

        {catalogQuery.isLoading ? (
          <PlanGridSkeleton />
        ) : catalogQuery.error ? (
          <div role="alert" className="text-sm text-mist">
            {copy.upgrade.error}
          </div>
        ) : (
          <div
            data-testid="upgrade-plan-grid"
            className="grid md:grid-cols-3 gap-6 w-full items-stretch"
          >
            <FreePlanCard
              isCurrent={subscriptionQuery.data?.subscription === null}
            />
            {catalogQuery.data?.plans.map((p) => (
              <PaidPlanCard
                key={p.key}
                plan={p}
                isCurrent={subscriptionQuery.data?.subscription?.plan === p.key}
                onSubscribe={() => checkoutMutation.mutate({ plan: p.key })}
                pendingPlan={
                  checkoutMutation.isPending
                    ? checkoutMutation.variables?.plan ?? null
                    : null
                }
                error={
                  checkoutMutation.error
                    ? copy.upgrade.plan.checkoutFailed
                    : null
                }
              />
            ))}
          </div>
        )}

        <PaygCard
          balance={shell.user.credits}
          onTopUp={() => setTopUpOpen(true)}
        />
      </div>

      <TopUpModal
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        companyId={companyId}
        currentBalance={shell.user.credits}
      />
    </div>
  );
}

export default Upgrade;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  companyId,
  navigate,
}: {
  companyId: string;
  navigate: (to: string) => void;
}) {
  return (
    <header
      data-testid="upgrade-header"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-white shrink-0 sticky top-0 z-10"
    >
      <button
        type="button"
        onClick={() => navigate(`/c/${companyId}`)}
        className="text-mist hover:text-ink transition-colors flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        {copy.upgrade.backCta}
      </button>
      <span className="text-sm text-mist flex items-center gap-1">
        Stripe checkout <ArrowUpRight className="size-3" strokeWidth={1.5} />
      </span>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Plan cards
// ---------------------------------------------------------------------------

function FreePlanCard({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div
      data-testid="plan-card-free"
      className="bg-white border border-hairline rounded-3xl p-8 shadow-sm flex flex-col relative overflow-hidden"
    >
      {isCurrent && (
        <div className="absolute top-0 right-0 bg-ink text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
          {copy.upgrade.free.currentBadge}
        </div>
      )}
      <div className="mb-6 border-b border-hairline pb-6">
        <h3 className="text-xl font-medium mb-1 tracking-tight">
          {copy.upgrade.free.title}
        </h3>
        <p className="text-mist text-sm h-10">{copy.upgrade.free.blurb}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl">{copy.upgrade.free.price}</span>
        </div>
      </div>
      <ul className="space-y-3 text-sm text-mist flex-1">
        {["AI agents", "1 product subdomain", "1 collaborator", "Community support"].map((f) => (
          <li key={f} className="flex items-center gap-3">
            <Check className="size-3.5 text-ink" strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="w-full mt-8 py-3 rounded-xl border border-hairline bg-cream text-mist text-sm font-medium cursor-not-allowed"
      >
        {copy.upgrade.free.currentCta}
      </button>
    </div>
  );
}

function PaidPlanCard({
  plan,
  isCurrent,
  onSubscribe,
  pendingPlan,
  error,
}: {
  plan: SubscriptionPlanCatalogEntry;
  isCurrent: boolean;
  onSubscribe: () => void;
  pendingPlan: SubscriptionPlanKey | null;
  error: string | null;
}) {
  const isStarter = plan.key === "starter";
  const features = PLAN_FEATURES[plan.key];
  const dollars = (plan.monthlyPriceCents / 100).toFixed(0);
  const isPending = pendingPlan === plan.key;
  const blurb = isStarter
    ? copy.upgrade.plan.starterBlurb
    : copy.upgrade.plan.proBlurb;
  const cardClass = isStarter
    ? "bg-ink text-white border-ink"
    : "bg-white border-hairline";
  const borderClass = isStarter ? "border-white/20" : "border-hairline";
  const blurbClass = isStarter ? "text-white/60" : "text-mist";
  const featureTextClass = isStarter ? "text-white/80" : "text-mist";
  const checkClass = isStarter ? "text-white" : "text-ink";
  const buttonClass = isStarter
    ? "bg-white text-ink hover:bg-neutral-200"
    : "bg-ink text-white hover:bg-neutral-800";

  return (
    <div
      data-testid={`plan-card-${plan.key}`}
      className={`border rounded-3xl p-8 shadow-sm flex flex-col ${cardClass}`}
    >
      <div className={`mb-6 border-b pb-6 ${borderClass}`}>
        <h3 className="text-xl font-medium mb-1 tracking-tight">{plan.displayName}</h3>
        <p className={`text-sm h-10 ${blurbClass}`}>{blurb}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl tracking-tight">${dollars}</span>
          <span className={blurbClass}>{copy.upgrade.plan.perMonth}</span>
        </div>
      </div>
      <ul className={`space-y-3 text-sm flex-1 ${featureTextClass}`}>
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3">
            <Check className={`size-3.5 ${checkClass}`} strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      {!plan.priceConfigured && (
        <p
          data-testid={`plan-${plan.key}-not-configured`}
          className={`text-[11px] mt-4 ${isStarter ? "text-amber-300" : "text-amber-700"}`}
        >
          {copy.upgrade.plan.missingPriceTooltip(
            plan.key === "starter" ? "STRIPE_PRICE_STARTER" : "STRIPE_PRICE_PRO",
          )}
        </p>
      )}
      <button
        type="button"
        data-testid={`subscribe-${plan.key}`}
        disabled={!plan.priceConfigured || isPending || isCurrent}
        onClick={onSubscribe}
        className={`w-full mt-8 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${buttonClass}`}
      >
        {isCurrent
          ? copy.upgrade.free.currentCta
          : isPending
          ? copy.upgrade.plan.subscribingCta
          : copy.upgrade.plan.subscribeCta}
      </button>
      {error && pendingPlan === plan.key && (
        <p className="text-[11px] text-red-600 mt-2" role="alert">{error}</p>
      )}
    </div>
  );
}

function PlanGridSkeleton() {
  return (
    <div className="grid md:grid-cols-3 gap-6 w-full">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-96 bg-white border border-hairline rounded-3xl animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pay-as-you-go strip
// ---------------------------------------------------------------------------

function PaygCard({
  balance,
  onTopUp,
}: {
  balance: number;
  onTopUp: () => void;
}) {
  return (
    <div
      data-testid="payg-card"
      className="w-full bg-white border border-hairline rounded-2xl p-6 shadow-sm mt-8 flex sm:flex-row flex-col justify-between items-center sm:gap-0 gap-4"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-cream rounded-full flex items-center justify-center border border-hairline shadow-inner">
          <Coins className="size-5 text-amber-500" strokeWidth={1.5} />
        </div>
        <div>
          <h4 className="font-medium mb-0.5">{copy.upgrade.payg.heading}</h4>
          <p className="text-sm text-mist">{copy.upgrade.payg.blurb}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-mist bg-cream px-3 py-1.5 border border-hairline rounded-md">
          {copy.upgrade.payg.currentBalanceLabel}{" "}
          <span className="text-ink ml-1 font-bold">{balance.toFixed(2)}</span>
        </span>
        <button
          type="button"
          data-testid="open-topup-cta"
          onClick={onTopUp}
          className="bg-ink text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
        >
          <Plus className="size-3" strokeWidth={2.5} />
          {copy.upgrade.payg.topUpCta}
        </button>
      </div>
    </div>
  );
}
