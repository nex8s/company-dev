import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useParams } from "@/lib/router";
import { companyTasks as copy } from "@/copy/company-tasks";
import {
  useCompanyTasksData,
  type KanbanCard,
  type KanbanColumn,
} from "@/hooks/useCompanyTasksData";

const COLUMN_DEFS = [
  { id: "needsReview", labelKey: "needsReview", dotClass: "bg-amber-400" },
  { id: "inProgress", labelKey: "inProgress", dotClass: "bg-blue-500" },
  { id: "queued", labelKey: "queued", dotClass: "bg-amber-400 opacity-60" },
  { id: "completed", labelKey: "completed", dotClass: "bg-emerald-500" },
] as const;

type FilterId = "all" | "active" | "backlog" | "done";

const FILTER_DEFS: { id: FilterId; labelKey: "all" | "active" | "backlog" | "done" }[] = [
  { id: "all", labelKey: "all" },
  { id: "active", labelKey: "active" },
  { id: "backlog", labelKey: "backlog" },
  { id: "done", labelKey: "done" },
];

// Map filter → which kanban column IDs to show
const FILTER_TO_COLUMNS: Record<FilterId, string[]> = {
  all: ["needsReview", "inProgress", "queued", "completed"],
  active: ["needsReview", "inProgress"],
  backlog: ["queued"],
  done: ["completed"],
};

export function CompanyTasks() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const { columns, approveReview, rejectReview } = useCompanyTasksData(companyId);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  const visibleColumns = columns.filter((col) =>
    FILTER_TO_COLUMNS[activeFilter].includes(col.id),
  );

  const handleNewTask = useCallback(async () => {
    const title = prompt("Task title:");
    if (!title?.trim()) return;
    try {
      await fetch(`/api/companies/${companyId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          status: "backlog",
        }),
      });
      // Refetch — the hook polls, but force immediate
      window.location.reload();
    } catch {
      alert("Failed to create task");
    }
  }, [companyId]);

  return (
    <div
      data-testid="company-tasks"
      className="flex-1 flex flex-col h-full bg-cream/40 overflow-hidden"
    >
      <Header
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onNewTask={handleNewTask}
      />
      <div
        data-testid="kanban-board"
        className="flex-1 overflow-x-auto p-6 flex items-start gap-4"
      >
        {visibleColumns.map((col) => {
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

function Header({
  activeFilter,
  onFilterChange,
  onNewTask,
}: {
  activeFilter: FilterId;
  onFilterChange: (f: FilterId) => void;
  onNewTask: () => void;
}) {
  return (
    <header
      data-testid="tasks-header"
      className="h-14 border-b border-hairline flex items-center justify-between px-6 bg-white shrink-0"
    >
      <nav aria-label="Task filters" className="flex items-center gap-6 h-full">
        {FILTER_DEFS.map((f) => (
          <button
            key={f.id}
            type="button"
            data-filter={f.id}
            aria-current={activeFilter === f.id ? "page" : undefined}
            onClick={() => onFilterChange(f.id)}
            className={`h-full px-1 border-b-2 font-medium text-sm transition-colors ${
              activeFilter === f.id
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
        onClick={onNewTask}
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
      className="w-80 shrink-0 flex flex-col max-h-full"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-mist flex items-center gap-2 uppercase">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          {title}
          <span className="bg-black/5 text-ink px-1.5 rounded normal-case">
            {column.cards.length}
          </span>
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
    <div data-testid={testId} role="status" aria-busy="true" className="space-y-3">
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
      <div className="h-24 bg-white border border-hairline rounded-xl animate-pulse" />
    </div>
  );
}

function ColumnError({ testId, message }: { testId: string; message: string }) {
  return (
    <div data-testid={testId} role="alert" className="h-24 border-2 border-dashed border-red-200 bg-red-50 rounded-xl flex items-center justify-center text-xs text-red-700 px-4 text-center">
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
