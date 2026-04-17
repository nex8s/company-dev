import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Coins, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/api/client";
import {
  pluginPaymentsApi,
  type TopUpCatalogEntry,
  type TopUpCredits,
} from "@/api/plugin-payments";
import { payments as copy } from "@/copy/payments";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";

/**
 * C-11 Top-up modal. Reads `pluginPaymentsApi.getCatalog` for the
 * `topUps` array and POSTs to `/checkout/top-up`. On success the
 * window navigates to the Stripe Checkout URL; the company chat is
 * the success-redirect target.
 *
 * Lives outside the Upgrade page so it can be opened from elsewhere
 * (e.g. UserMenu's "Top Up Credits" item) without re-routing.
 */

const POPULAR_CREDITS: TopUpCredits = 50;
const BEST_VALUE_CREDITS: TopUpCredits = 100;

export interface TopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * companyId override — when invoked from a non-routed surface the
   * caller must pass it. Otherwise we read from useParams.
   */
  companyId?: string;
  currentBalance?: number;
}

export function TopUpModal({
  open,
  onOpenChange,
  companyId: companyIdOverride,
  currentBalance = 0,
}: TopUpModalProps) {
  const params = useParams<{ companyId: string }>();
  const companyId = companyIdOverride ?? params.companyId ?? "";
  const [selected, setSelected] = useState<TopUpCredits>(POPULAR_CREDITS);

  const catalogQuery = useQuery({
    queryKey: queryKeys.pluginPayments.catalog(companyId),
    queryFn: () => pluginPaymentsApi.getCatalog(companyId),
    enabled: open && companyId.length > 0,
  });

  const checkoutMutation = useMutation<string, ApiError, { credits: TopUpCredits }>({
    mutationFn: async ({ credits }) => {
      const origin = window.location.origin;
      const response = await pluginPaymentsApi.createTopUpCheckout(companyId, {
        credits,
        successUrl: `${origin}/c/${companyId}?stripe=success&credits=${credits}`,
        cancelUrl: `${origin}/c/${companyId}/upgrade?stripe=canceled`,
      });
      const url = response.checkout.url;
      if (!url) throw new ApiError("checkout url missing", 502, response);
      return url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const topUps = catalogQuery.data?.topUps ?? [];
  const selectedOption = topUps.find((t) => t.credits === selected) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="topup-modal"
        className="max-w-2xl rounded-3xl border-hairline p-0"
      >
        <div className="px-8 pt-8 pb-6">
          <DialogTitle className="text-2xl font-medium tracking-tight mb-2 flex items-center gap-2">
            <Coins className="size-5 text-amber-500" strokeWidth={1.5} />
            {copy.topUp.title}
          </DialogTitle>
          <DialogDescription className="text-mist text-sm">
            {copy.topUp.currentBalance(currentBalance)}
          </DialogDescription>
        </div>

        {catalogQuery.isLoading ? (
          <div className="px-8 pb-8 grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 border border-hairline rounded-xl bg-cream/40 animate-pulse"
              />
            ))}
          </div>
        ) : catalogQuery.error ? (
          <div className="px-8 pb-8 text-sm text-mist" role="alert">
            {copy.topUp.error}
          </div>
        ) : (
          <div
            data-testid="topup-options"
            className="px-8 grid grid-cols-2 gap-4 mb-8"
          >
            {topUps.map((opt) => (
              <TopUpOptionCard
                key={opt.credits}
                option={opt}
                selected={selected === opt.credits}
                onSelect={() => setSelected(opt.credits)}
              />
            ))}
          </div>
        )}

        <div className="bg-cream/60 border-t border-hairline p-6 flex flex-col gap-4">
          {selectedOption && (
            <div className="text-sm text-mist">
              {copy.topUp.youReceive(
                selectedOption.credits,
                (selectedOption.amountCents / 100).toFixed(2),
              )}
              {" · "}
              {copy.topUp.newBalance(currentBalance + selectedOption.credits)}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-mist">
              <Lock className="size-3" strokeWidth={1.5} />
              {copy.topUp.securedByStripe}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                data-testid="topup-cancel"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black/5"
              >
                {copy.topUp.cancelCta}
              </button>
              <button
                type="button"
                data-testid="topup-purchase"
                disabled={
                  !selectedOption?.priceConfigured || checkoutMutation.isPending
                }
                onClick={() => checkoutMutation.mutate({ credits: selected })}
                className="px-6 py-2.5 rounded-full bg-ink text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {checkoutMutation.isPending
                  ? copy.topUp.purchasingCta
                  : copy.topUp.purchaseCta}
              </button>
            </div>
          </div>
          {checkoutMutation.error && (
            <p className="text-[11px] text-red-600" role="alert">
              {copy.topUp.checkoutFailed}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopUpOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: TopUpCatalogEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const dollars = (option.amountCents / 100).toFixed(2);
  const showPopular = option.credits === POPULAR_CREDITS;
  const showBestValue = option.credits === BEST_VALUE_CREDITS;
  const tone = selected
    ? "border-2 border-ink"
    : "border border-hairline hover:border-black/30";
  return (
    <button
      type="button"
      data-testid={`topup-option-${option.credits}`}
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      disabled={!option.priceConfigured}
      className={`text-left rounded-xl p-5 bg-white relative transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tone}`}
    >
      {showPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] uppercase font-bold tracking-wider px-3 py-0.5 rounded-full">
          {copy.topUp.popularBadge}
        </div>
      )}
      {showBestValue && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-0.5 rounded-full">
          {copy.topUp.bestValueBadge}
        </div>
      )}
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-lg">
          {option.credits}{" "}
          <span className="text-sm font-normal text-mist">{copy.topUp.creditsSuffix}</span>
        </span>
        <span className="text-lg">${dollars}</span>
      </div>
      {!option.priceConfigured && (
        <span className="text-[10px] text-amber-700 block mt-1">
          Price not configured
        </span>
      )}
    </button>
  );
}
