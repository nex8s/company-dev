import { useState } from "react";
import { ArrowDownUp, ArrowUpFromLine, FileText, Search } from "lucide-react";
import { useParams } from "@/lib/router";
import { drive as copy } from "@/copy/drive";
import {
  DRIVE_DEPARTMENTS,
  useDriveData,
  type DriveDepartment,
  type DriveFileRow,
  type DriveFilter,
} from "@/hooks/useDriveData";

/**
 * C-07 Drive view. Sibling top-level page mounted at `/c/:companyId/drive`.
 * Sidebar Drive nav active, breadcrumb hides.
 *
 * Layout (matches `ui-import/dashboard.html` line ~1186): Header bar
 * (search + source filter + sort + Upload) + left filter rail (All Files,
 * 5 departments, Pending) + main panel (table when there are matching
 * files, layered-cards empty state otherwise).
 *
 * Data is a typed mock from `useDriveData` — see that hook's header for
 * the swap to the future plugin-drive HTTP route.
 */
export function Drive() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const [filter, setFilter] = useState<DriveFilter>({ kind: "all" });
  const data = useDriveData(companyId, filter);

  return (
    <div
      data-testid="drive-view"
      className="flex-1 flex flex-col h-full bg-white overflow-hidden"
    >
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <FilterRail
          filter={filter}
          onFilterChange={setFilter}
          departmentCounts={data.departmentCounts}
          pendingCount={data.pendingCount}
        />
        <MainPanel filter={filter} data={data} />
      </div>
    </div>
  );
}

export default Drive;

function Header() {
  return (
    <header
      data-testid="drive-header"
      className="h-16 border-b border-hairline flex items-center justify-between px-6 bg-cream shrink-0"
    >
      <h1 className="font-medium text-lg">{copy.page.title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-white border border-hairline rounded-md px-3 py-1.5 w-64">
          <Search className="size-4 text-mist mr-2" strokeWidth={1.5} />
          <input
            type="text"
            placeholder={copy.page.searchPlaceholder}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-mist"
          />
        </div>
        <span className="bg-white border border-hairline rounded-md px-3 py-1.5 text-sm text-mist">
          {copy.page.sourceFilterAll}
        </span>
        <span className="bg-white border border-hairline rounded-md px-3 py-1.5 text-sm text-mist flex items-center gap-2">
          <ArrowDownUp className="size-3.5" strokeWidth={1.5} />
          {copy.page.sortLabel}
        </span>
        <button
          type="button"
          className="bg-ink text-white hover:bg-neutral-800 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <ArrowUpFromLine className="size-4" strokeWidth={1.5} />
          {copy.page.uploadCta}
        </button>
        <span className="text-[10px] text-mist border border-hairline rounded px-1.5 py-0.5">
          {copy.stub.badge}
        </span>
      </div>
    </header>
  );
}

function FilterRail({
  filter,
  onFilterChange,
  departmentCounts,
  pendingCount,
}: {
  filter: DriveFilter;
  onFilterChange: (f: DriveFilter) => void;
  departmentCounts: Record<DriveDepartment, number>;
  pendingCount: number;
}) {
  return (
    <aside
      data-testid="drive-rail"
      className="w-48 border-r border-hairline bg-cream/40 p-4 flex flex-col gap-1 shrink-0 text-sm"
    >
      <RailButton
        testId="drive-filter-all"
        label={copy.filter.allFiles}
        active={filter.kind === "all"}
        onClick={() => onFilterChange({ kind: "all" })}
      />
      <div className="my-2 border-t border-hairline" />
      {DRIVE_DEPARTMENTS.map((dept) => (
        <RailButton
          key={dept}
          testId={`drive-filter-${dept.toLowerCase()}`}
          label={dept}
          count={departmentCounts[dept]}
          active={filter.kind === "department" && filter.department === dept}
          onClick={() => onFilterChange({ kind: "department", department: dept })}
        />
      ))}
      <div className="my-2 border-t border-hairline" />
      <RailButton
        testId="drive-filter-pending"
        label={copy.filter.pending}
        countTone="amber"
        count={pendingCount}
        active={filter.kind === "pending"}
        onClick={() => onFilterChange({ kind: "pending" })}
      />
    </aside>
  );
}

function RailButton({
  testId,
  label,
  count,
  countTone,
  active,
  onClick,
}: {
  testId: string;
  label: string;
  count?: number;
  countTone?: "amber";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`px-3 py-2 rounded-md w-full text-left flex items-center justify-between transition-colors ${
        active ? "bg-black/5 font-medium" : "text-mist hover:text-ink hover:bg-black/5"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={`text-[10px] px-1.5 rounded ${
            countTone === "amber"
              ? "bg-amber-400 text-white"
              : "bg-black/5 text-ink"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function MainPanel({
  filter,
  data,
}: {
  filter: DriveFilter;
  data: ReturnType<typeof useDriveData>;
}) {
  if (data.isLoading) {
    return (
      <main className="flex-1 bg-white p-8" role="status" aria-busy="true">
        <div className="h-32 bg-cream/40 border border-hairline rounded-xl animate-pulse" />
      </main>
    );
  }
  if (data.error) {
    return (
      <main className="flex-1 bg-white p-8 text-sm text-mist" role="alert">
        {copy.error}
      </main>
    );
  }
  if (data.visibleFiles.length === 0) {
    return <EmptyState />;
  }
  return <FileTable rows={data.visibleFiles} pendingFilter={filter.kind === "pending"} />;
}

function EmptyState() {
  return (
    <main
      data-testid="drive-empty"
      className="flex-1 bg-white flex flex-col items-center justify-center p-8"
    >
      <div className="relative w-32 h-32 mb-6">
        <div className="absolute bottom-0 left-4 w-20 h-24 bg-cream border border-hairline rounded shadow-sm rotate-[-10deg]" />
        <div className="absolute bottom-2 left-6 w-20 h-24 bg-cream/60 border border-hairline rounded shadow rotate-[-5deg]" />
        <div className="absolute bottom-4 left-8 w-20 h-24 bg-white border border-dashed border-hairline rounded shadow-md flex items-center justify-center text-mist text-2xl z-10">
          +
        </div>
      </div>
      <p className="text-mist max-w-sm text-center text-sm mb-6 leading-relaxed">
        {copy.empty.body}
      </p>
      <button
        type="button"
        className="border border-hairline bg-white shadow-sm hover:bg-black/5 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2"
      >
        <ArrowUpFromLine className="size-4" strokeWidth={1.5} />
        {copy.empty.cta}
      </button>
    </main>
  );
}

function FileTable({ rows, pendingFilter }: { rows: readonly DriveFileRow[]; pendingFilter: boolean }) {
  return (
    <main data-testid="drive-table" className="flex-1 bg-white overflow-y-auto">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-hairline bg-cream text-xs font-semibold text-mist uppercase tracking-wider">
        <div className="col-span-6">{copy.table.name}</div>
        <div className="col-span-2">{copy.table.source}</div>
        <div className="col-span-2">{copy.table.folder}</div>
        <div className="col-span-2 text-right">{copy.table.modified}</div>
      </div>
      {rows.map((row) => (
        <FileRow key={row.id} row={row} />
      ))}
      {pendingFilter && rows.length === 0 && (
        <div className="flex flex-col items-center pt-20 text-mist">
          <p className="text-sm">{copy.pendingEmpty}</p>
        </div>
      )}
    </main>
  );
}

function FileRow({ row }: { row: DriveFileRow }) {
  return (
    <div
      data-testid={`drive-file-${row.id}`}
      data-status={row.status}
      className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-hairline hover:bg-black/5 cursor-pointer items-center text-sm"
    >
      <div className="col-span-6 flex items-center gap-3 min-w-0">
        <FileText className="size-5 text-blue-500" strokeWidth={1.5} />
        <span className="font-medium truncate">{row.name}</span>
        {row.status === "pending_review" && (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
            {copy.table.pendingBadge}
          </span>
        )}
      </div>
      <div className="col-span-2 text-mist truncate">{row.source}</div>
      <div className="col-span-2 text-mist truncate">{row.department}</div>
      <div className="col-span-2 text-right text-mist">
        {new Date(row.modifiedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>
  );
}
