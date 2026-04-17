import { Flag, MessageCircle, Target, Users } from "lucide-react";
import { useParams } from "@/lib/router";
import { companyTabs as copy } from "@/copy/company-tabs";
import { useCompanyTabsData, type ActivePlan, type StrategyData } from "@/hooks/useCompanyTabsData";

/**
 * Company > Strategy — C-05 tab 2. Positioning + Target Audience cards,
 * Core Growth Strategy callout, Active Plans list, Goals empty state.
 *
 * All four copy fields map 1:1 to the A-02 CompanyProfile columns
 * (`positioning`, `target_audience`, `strategy_text`, plus `name` for the
 * hero). Active Plans / Goals are stubs — the plugin-company Plan/Goal
 * module will land in a later backend task and swap the hook mock.
 */
export function CompanyStrategy() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const data = useCompanyTabsData(companyId);

  if (data.isLoading) return <StrategySkeleton />;
  if (data.error) return <StrategyError message={copy.strategy.error} />;

  return (
    <main
      id="main-content"
      data-testid="company-strategy"
      className="flex-1 overflow-y-auto p-8 bg-cream/40 space-y-6"
    >
      <h2 className="text-lg font-medium border-b border-hairline pb-2">
        {copy.strategy.heading}
      </h2>

      <section className="grid grid-cols-2 gap-4">
        <StrategyField
          testId="strategy-positioning"
          label={copy.strategy.positioningLabel}
          icon={<Target className="size-3.5" strokeWidth={1.5} />}
          body={data.strategy.positioning}
        />
        <StrategyField
          testId="strategy-audience"
          label={copy.strategy.audienceLabel}
          icon={<Users className="size-3.5" strokeWidth={1.5} />}
          body={data.strategy.targetAudience}
        />
      </section>

      <CoreStrategyCallout body={data.strategy.coreStrategy} />

      <ActivePlansSection plans={data.strategy.activePlans} />

      <GoalsSection count={data.strategy.goalsCount} />
    </main>
  );
}

export default CompanyStrategy;

// ---------------------------------------------------------------------------
// Strategy field card
// ---------------------------------------------------------------------------

function StrategyField({
  testId,
  label,
  icon,
  body,
}: {
  testId: string;
  label: string;
  icon: React.ReactNode;
  body: string | null;
}) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm flex flex-col gap-2"
    >
      <div className="text-[10px] font-semibold text-mist uppercase tracking-wider flex items-center gap-2">
        {icon} {label}
      </div>
      <p className="text-sm text-mist leading-relaxed">
        {body ?? (
          <span className="italic opacity-70">{copy.strategy.emptyField}</span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Core strategy callout
// ---------------------------------------------------------------------------

function CoreStrategyCallout({ body }: { body: string | null }) {
  return (
    <div
      data-testid="strategy-core"
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm flex flex-col gap-2 border-l-4 border-l-ink"
    >
      <div className="text-[10px] font-semibold text-mist uppercase tracking-wider">
        {copy.strategy.coreStrategyLabel}
      </div>
      <p className="text-base font-medium text-ink leading-relaxed">
        {body ?? (
          <span className="italic opacity-70">{copy.strategy.emptyField}</span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active plans
// ---------------------------------------------------------------------------

function ActivePlansSection({ plans }: { plans: StrategyData["activePlans"] }) {
  return (
    <section className="mt-4" data-testid="strategy-plans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">
          {copy.strategy.activePlansHeading}
        </h3>
        <a href="#" className="text-xs text-mist hover:text-ink">
          {copy.strategy.activePlansViewAll}
        </a>
      </div>
      {plans.length === 0 ? (
        <div className="bg-white border border-hairline rounded-xl p-5 text-sm text-mist">
          {copy.strategy.activePlansEmpty}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <ActivePlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivePlanCard({ plan }: { plan: ActivePlan }) {
  const progress = plan.total === 0 ? 0 : (plan.completed / plan.total) * 100;
  return (
    <div
      data-testid={`plan-${plan.id}`}
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm flex flex-col gap-4"
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium text-lg mb-1 flex items-center gap-2">
            {plan.name}{" "}
            {plan.status === "in_progress" && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {copy.strategy.planInProgressBadge}
              </span>
            )}
          </h4>
          <p className="text-sm text-mist">{plan.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-xs text-mist font-medium w-10">
          {plan.completed}/{plan.total}
        </div>
        <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-ink rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-mist bg-cream border border-hairline px-2 py-0.5 rounded">
          {copy.strategy.activeAgentsLabel(plan.activeAgents)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

function GoalsSection({ count }: { count: number }) {
  if (count > 0) {
    // Placeholder for real goals list — the API ships with a future A-task.
    return (
      <section data-testid="strategy-goals-list" className="mt-4">
        <h3 className="text-sm font-semibold mb-4">{copy.strategy.goalsHeading}</h3>
        <p className="text-sm text-mist">{count} goals</p>
      </section>
    );
  }
  return (
    <section data-testid="strategy-goals-empty" className="mt-4">
      <h3 className="text-sm font-semibold mb-4">{copy.strategy.goalsHeading}</h3>
      <div className="border border-dashed border-black/20 bg-white/50 rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4">
        <Flag className="size-8 text-mist" strokeWidth={1.5} />
        <p className="text-mist max-w-md text-sm">{copy.strategy.goalsEmpty}</p>
        <button
          type="button"
          className="bg-white border border-hairline shadow-sm hover:bg-black/5 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
        >
          <MessageCircle className="size-4" strokeWidth={1.5} />
          {copy.strategy.goalsCta}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function StrategySkeleton() {
  return (
    <main
      data-testid="strategy-skeleton"
      role="status"
      aria-busy="true"
      className="flex-1 overflow-y-auto p-8 bg-cream/40 space-y-6"
    >
      <div className="h-6 w-48 bg-white border border-hairline rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
        <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
      </div>
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
    </main>
  );
}

function StrategyError({ message }: { message: string }) {
  return (
    <main
      data-testid="strategy-error"
      role="alert"
      className="flex-1 flex items-center justify-center bg-cream/40 p-8"
    >
      <p className="text-sm text-mist">{message}</p>
    </main>
  );
}
