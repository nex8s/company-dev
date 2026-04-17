import { CreditCard, Plus } from "lucide-react";
import { employeeDetail as copy } from "@/copy/employee-detail";
import type { VirtualCardDto } from "@/api/plugin-identity";
import type { EmployeeDetailData } from "@/hooks/useEmployeeDetailData";

/**
 * C-09 Virtual Cards tab — the only provider-backed tab with a live HTTP
 * endpoint today. Backed by B-13's `GET /plugin-identity/agents/:agentId/cards`
 * plus the `issue` / `freeze` POSTs.
 *
 * Separated from the rest of the EmployeeDetail tab code to keep its
 * React-Query wiring + mutation state isolated for testing.
 */
export function VirtualCardsTab({
  virtualCards,
}: {
  virtualCards: EmployeeDetailData["virtualCards"];
}) {
  const { cards, isLoading, error, issueCard, freezeCard } = virtualCards;
  const issuing = issueCard.isPending;

  return (
    <section
      id="main-content"
      data-testid="employee-tab-virtual-cards"
      className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">{copy.virtualCards.heading}</h2>
        <button
          type="button"
          data-testid="issue-card-cta"
          disabled={issuing}
          onClick={() => issueCard.mutate()}
          className="bg-black text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="size-3" strokeWidth={2.5} />
          {issuing ? copy.virtualCards.issuing : copy.virtualCards.issueCta}
        </button>
      </div>

      {isLoading ? (
        <CardsSkeleton />
      ) : error ? (
        <div
          data-testid="virtual-cards-error"
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700"
        >
          {copy.virtualCards.error}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          data-testid="virtual-cards-list"
          className="grid grid-cols-2 gap-4"
        >
          {cards.map((card) => (
            <CardRow
              key={card.cardId}
              card={card}
              onFreeze={() => freezeCard.mutate({ cardId: card.cardId })}
              freezePending={freezeCard.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CardRow({
  card,
  onFreeze,
  freezePending,
}: {
  card: VirtualCardDto;
  onFreeze: () => void;
  freezePending: boolean;
}) {
  const badgeCopy =
    card.status === "active"
      ? copy.virtualCards.activeBadge
      : card.status === "frozen"
      ? copy.virtualCards.frozenBadge
      : copy.virtualCards.closedBadge;
  const badgeTone =
    card.status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : card.status === "frozen"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-black/5 text-mist border-hairline";

  return (
    <li
      data-testid={`virtual-card-${card.cardId}`}
      className="bg-white border border-hairline p-5 rounded-xl shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cream border border-hairline flex items-center justify-center text-ink">
            <CreditCard className="size-5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-medium text-sm">
              {copy.virtualCards.last4Label(card.last4)}
            </p>
            <p className="text-xs text-mist">
              {copy.virtualCards.limitLabel(card.spendingLimitUsd)}
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${badgeTone}`}
        >
          {badgeCopy}
        </span>
      </div>
      <p className="text-xs text-mist">
        {copy.virtualCards.spentLabel(card.spentUsd)}
      </p>
      {card.status === "active" && (
        <button
          type="button"
          data-testid={`freeze-${card.cardId}`}
          disabled={freezePending}
          onClick={onFreeze}
          className="border border-hairline text-xs py-1.5 rounded-full hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {freezePending ? copy.virtualCards.freezing : copy.virtualCards.freezeCta}
        </button>
      )}
    </li>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="virtual-cards-empty"
      className="border border-dashed border-black/20 rounded-xl p-10 text-center"
    >
      <CreditCard className="size-8 mx-auto text-mist mb-2" strokeWidth={1.5} />
      <p className="text-sm text-mist">{copy.virtualCards.empty}</p>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div
      data-testid="virtual-cards-skeleton"
      role="status"
      aria-busy="true"
      className="grid grid-cols-2 gap-4"
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-28 bg-white border border-hairline rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}
