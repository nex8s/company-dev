import { CreditCard, Zap } from "lucide-react";
import { companyTabs as copy } from "@/copy/company-tabs";

/**
 * Company > Payments — C-05 tab 3. Stub Stripe empty state until B-07 ships
 * the Stripe Connect integration. When B-07 merges, this component branches
 * on `connected` and renders the payments timeline.
 */
export function CompanyPayments() {
  return (
    <main
      id="main-content"
      data-testid="company-payments"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8"
    >
      <div
        data-testid="payments-stripe-empty"
        className="max-w-md flex flex-col items-center text-center gap-4"
      >
        <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shadow-inner mb-4">
          <CreditCard className="size-8" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-medium tracking-tight">
          {copy.payments.emptyTitle}
        </h2>
        <p className="text-sm text-mist leading-relaxed mb-4">
          {copy.payments.emptyBody}
        </p>
        <button
          type="button"
          className="bg-black text-white hover:bg-neutral-800 px-5 py-2.5 rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5 shadow-lg flex items-center gap-2"
        >
          <Zap className="size-4" strokeWidth={2} />
          {copy.payments.emptyCta}
        </button>
      </div>
    </main>
  );
}

export default CompanyPayments;
