import { Plus } from "lucide-react";
import { useParams } from "@/lib/router";
import { companyTasks as copy } from "@/copy/company-tasks";
import {
  useCompanyTasksData,
  type KanbanCard,
  type KanbanColumn,
} from "@/hooks/useCompanyTasksData";

/**
 * Company > Tasks (kanban) — C-06. Sibling top-level view to the Company
 * sub-tabs (Chat / Overview / Strategy / Payments / Settings); reached
 * from the sidebar Tasks nav item, NOT the breadcrumb.
 *
 * Needs Review is wired live to A-06.5's pending-reviews endpoint via
 * `useCompanyTasksData`. The other three columns are typed-mock stubs
 * flagged with the A-08 swap point in the hook.
 *
 * Filter tabs (All / Active / Backlog / Done) and the New Task CTA are
 * rendered to match `ui-import/dashboard.html` line ~960. Filter logic
 * lands when A-08's status enum stabilizes; today they're decorative
 * and Approve/Reject are the only interactive controls.
 */

const COLUMN_DEFS = [
  { id: "needsReview", labelKey: "needsReview", dotClass: "bg-amber-400" },
  { id: "inProgress", labelKey: "inProgress", dotClass: "bg-blue-500" },
  { id: "queued", labelKey: "queued", dotClass: "bg-amber-400 opacity-60" },
  { id: "completed", labelKey: "completed", dotClass: "bg-emerald-500" },
] as const;

const FILTER_DEFS = [
  { id: "all", labelKey: "all" as const },
  { id: "active", labelKey: "active" as const },
  { id: "backlog", labelKey: "backlog" as const },
  { id: "done", labelKey: "done" as const },
] as const;

export function CompanyTasks() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const { columns, approveReview, rejectReview } = useCompanyTasksData(companyId);

  return (
    <div
      data-testid="company-tasks"
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <Header />
      <div
        data-testid="kanban-board"
        className="flex-1 overflow-x-auto p-6 flex items-start gap-4"
      >
        {columns.map((col) => {
          const def = COLUMN_DEFS.find((d) => d.id === col.id)!;
          return (
            <Column
              key={col.id}
              column={col}
              dotClass={def.dotClass}
              onApprove={(reviewId) => approveReview.mutate({ reviewId })}
              onReject={(reviewId) => rejectReview.mutate({ reviewId })}
              decisionPending={approveReview.isPending || rejectReview.isPending}
            />
          );
        })}
      </div>
    </div>
  );
}

export default CompanyTasks;

// ---------------------------------------------------------------------------
// Header — filter tabs + New Task CTA
// ---------------------------------------------------------------------------

function Header() {
  return (
    <header
      data-testid="tasks-header"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-white shrink-0"
    >
      <nav aria-label="Task filters" className="flex items-center gap-6 h-full">
        {FILTER_DEFS.map((f, i) => (
          <button
            key={f.id}
            type="button"
            data-filter={f.id}
            aria-current={i === 0 ? "page" : undefined}
            className={`h-full px-1 border-b-2 font-medium text-sm transition-colors ${
              i === 0
                ? "border-ink text-ink"
                : "border-transparent text-mist hover:text-ink"
            }`}
          >
            {copy.header.filters[f.labelKey]}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="bg-black text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
      >
        <Plus className="size-3" strokeWidth={2.5} /> {copy.header.newTaskCta}
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function Column({
  column,
  dotClass,
  onApprove,
  onReject,
  decisionPending,
}: {
  column: KanbanColumn;
  dotClass: string;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  decisionPending: boolean;
}) {
  const title = copy.columns[column.id];
  const emptyMsg = copy.emptyColumn[column.id];

  return (
    <div
      data-testid={`kanban-column-${column.id}`}
      className={`w-80 shrink-0 flex flex-col max-h-full ${
        column.isStub ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-mist flex items-center gap-2 uppercase">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          {title}
          <span className="bg-black/5 text-ink px-1.5 rounded normal-case">
            {column.cards.length}
          </span>
          {column.isStub && (
            <span
              data-testid={`stub-badge-${column.id}`}
              className="ml-1 text-[9px] text-mist border border-hairline rounded px-1.5 py-0.5 normal-case font-normal"
            >
              {copy.stubBadge}
            </span>
          )}
        </span>
      </div>

      {column.isLoading ? (
        <ColumnSkeleton testId={`column-skeleton-${column.id}`} />
      ) : column.error ? (
        <ColumnError testId={`column-error-${column.id}`} message={copy.error} />
      ) : column.cards.length === 0 ? (
        <EmptyColumn message={emptyMsg} />
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {column.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              onApprove={onApprove}
              onReject={onReject}
              decisionPending={decisionPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyColumn({ message }: { message: string }) {
  return (
    <div className="h-24 border-2 border-dashed border-hairline rounded-xl flex items-center justify-center text-xs text-mist px-4 text-center">
      {message}
    </div>
  );
}

function ColumnSkeleton({ testId }: { testId: string }) {
  return (
    <div
      data-testid={testId}
      role="status"
      aria-busy="true"
      className="space-y-3"
    >
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
    </div>
  );
}

function ColumnError({ testId, message }: { testId: string; message: string }) {
  return (
    <div
      data-testid={testId}
      role="alert"
      className="h-24 border-2 border-dashed border-red-200 bg-red-50 rounded-xl flex items-center justify-center text-xs text-red-700 px-4 text-center"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function Card({
  card,
  onApprove,
  onReject,
  decisionPending,
}: {
  card: KanbanCard;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  decisionPending: boolean;
}) {
  return (
    <div
      data-testid={`kanban-card-${card.id}`}
      data-card-kind={card.kind}
      className="kanban-card bg-white border border-hairline rounded-xl p-4 shadow-sm hover:shadow-md hover:border-black/20 flex flex-col gap-3 transition-shadow"
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-medium text-sm leading-snug">{card.title}</h4>
      </div>
      <div className="flex gap-2 flex-wrap">
        {card.assigneeLabel && (
          <span className="border border-hairline text-mist text-[10px] px-1.5 py-0.5 rounded truncate max-w-[140px]">
            {card.assigneeLabel}
          </span>
        )}
        {card.kind === "review" && card.identifier && (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
            {card.identifier} — {copy.card.forReviewBadge}
          </span>
        )}
        {card.kind === "task" && card.identifier && (
          <span className="text-[10px] text-mist uppercase">{card.identifier}</span>
        )}
      </div>
      {card.kind === "review" && card.reviewId !== null && (
        <div className="pt-2 border-t border-hairline mt-1 flex justify-between gap-2">
          <button
            type="button"
            data-testid={`reject-${card.id}`}
            disabled={decisionPending}
            onClick={() => onReject(card.reviewId!)}
            className="flex-1 py-1.5 rounded border border-hairline text-mist text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copy.card.rejectCta}
          </button>
          <button
            type="button"
            data-testid={`approve-${card.id}`}
            disabled={decisionPending}
            onClick={() => onApprove(card.reviewId!)}
            className="flex-1 py-1.5 rounded bg-black text-white text-xs hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {decisionPending ? copy.card.decisionPending : copy.card.approveCta}
          </button>
        </div>
      )}
    </div>
  );
}
