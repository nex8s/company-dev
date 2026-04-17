import { useState } from "react";
import { Check, Play, Share2 } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { store as copy } from "@/copy/store";
import {
  useStoreData,
  type SegmentFilter,
} from "@/hooks/useStoreData";
import type { StoreTemplateDto } from "@/api/plugin-store";

/**
 * C-08 Store view — top-level sibling page mounted at
 * `/c/:companyId/store`. Sidebar Store nav lights up; the company
 * breadcrumb hides on this path (same pattern as C-06 Tasks and C-09
 * Team).
 *
 * Header: title + segment toggle (All / Businesses / Employees).
 * Layout: two-column — filter rail (Business Categories + Employee
 * Departments), Featured grid of dark template cards. Each card has a
 * "Get" CTA that fires the install mutation; on success the page
 * navigates to the newly installed company's chat at `/c/:newId`.
 *
 * Data + install today come from a typed mock (`useStoreData`); see
 * that hook's header for the swap point when plugin-store's HTTP
 * routes mount.
 */
export function Store() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [category, setCategory] = useState<string | null>(null);

  const data = useStoreData({
    segment,
    category,
    onInstalled: (result) => {
      // Match the prototype + PLAN.md gate behavior: after the install
      // returns, take the user straight to the new company's chat view.
      navigate(`/c/${result.companyId}`);
    },
  });

  return (
    <div
      data-testid="store-view"
      className="flex-1 overflow-y-auto h-full bg-cream/40"
    >
      <Header segment={segment} onSegmentChange={setSegment} />
      <div className="flex max-w-7xl mx-auto w-full p-8 gap-8">
        <FilterRail
          activeCategory={category}
          onCategoryChange={setCategory}
          segment={segment}
        />
        <Grid data={data} />
      </div>
    </div>
  );
}

export default Store;

// ---------------------------------------------------------------------------
// Header — title + segment toggle
// ---------------------------------------------------------------------------

function Header({
  segment,
  onSegmentChange,
}: {
  segment: SegmentFilter;
  onSegmentChange: (s: SegmentFilter) => void;
}) {
  return (
    <header
      data-testid="store-header"
      className="bg-cream border-b border-hairline py-10 px-8 flex flex-col items-center justify-center text-center sticky top-0 z-20 shadow-sm"
    >
      <h1 className="text-4xl mb-3 tracking-wide">{copy.page.title}</h1>
      <p className="text-mist max-w-xl text-sm">{copy.page.subtitle}</p>
      <div
        data-testid="store-segment"
        role="tablist"
        aria-label="Template segment"
        className="mt-8 flex bg-white border border-hairline rounded-lg p-1 shadow-sm"
      >
        <SegmentButton
          id="all"
          label={copy.segment.all}
          active={segment === "all"}
          onClick={() => onSegmentChange("all")}
        />
        <SegmentButton
          id="business"
          label={copy.segment.businesses}
          active={segment === "business"}
          onClick={() => onSegmentChange("business")}
        />
        <SegmentButton
          id="employee"
          label={copy.segment.employees}
          active={segment === "employee"}
          onClick={() => onSegmentChange("employee")}
        />
        <SegmentButton
          id="myProfile"
          label={copy.segment.myProfile}
          active={false}
          onClick={() => {
            /* Reserved for the My Profile / Publishing page (C-12). */
          }}
        />
      </div>
    </header>
  );
}

function SegmentButton({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      data-segment={id}
      aria-selected={active}
      onClick={onClick}
      className={`px-5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-black text-white shadow"
          : "text-mist hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filter rail
// ---------------------------------------------------------------------------

function FilterRail({
  activeCategory,
  onCategoryChange,
  segment,
}: {
  activeCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  segment: SegmentFilter;
}) {
  return (
    <aside
      data-testid="store-rail"
      aria-label="Template filters"
      className="w-48 shrink-0 space-y-8"
    >
      <RailGroup
        heading={copy.rail.businessHeading}
        allLabel={copy.rail.allBusinesses}
        items={copy.businessCategories}
        activeCategory={activeCategory}
        onChange={onCategoryChange}
        disabled={segment === "employee"}
      />
      <RailGroup
        heading={copy.rail.employeeHeading}
        allLabel={copy.rail.allEmployees}
        items={copy.employeeDepartments}
        activeCategory={activeCategory}
        onChange={onCategoryChange}
        disabled={segment === "business"}
      />
    </aside>
  );
}

function RailGroup({
  heading,
  allLabel,
  items,
  activeCategory,
  onChange,
  disabled,
}: {
  heading: string;
  allLabel: string;
  items: readonly string[];
  activeCategory: string | null;
  onChange: (c: string | null) => void;
  disabled: boolean;
}) {
  return (
    <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
      <h4 className="text-[10px] font-semibold text-mist uppercase tracking-wider mb-3">
        {heading}
      </h4>
      <ul className="space-y-2 text-xs text-mist">
        <RailItem
          label={allLabel}
          active={activeCategory === null}
          onClick={() => onChange(null)}
        />
        {items.map((cat) => (
          <RailItem
            key={cat}
            label={cat}
            active={activeCategory === cat}
            onClick={() => onChange(cat)}
          />
        ))}
      </ul>
    </div>
  );
}

function RailItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        data-rail-item={label}
        onClick={onClick}
        className={`w-full flex items-center justify-between text-left transition-colors ${
          active
            ? "font-medium text-ink"
            : "hover:text-ink"
        }`}
      >
        <span>{label}</span>
        {active && <Check className="size-3" strokeWidth={2.5} />}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

function Grid({ data }: { data: ReturnType<typeof useStoreData> }) {
  if (data.isLoading) {
    return <GridSkeleton />;
  }
  if (data.error) {
    return (
      <div
        data-testid="store-grid-error"
        role="alert"
        className="flex-1 bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700"
      >
        {copy.grid.error}
      </div>
    );
  }
  if (data.visibleTemplates.length === 0) {
    return (
      <div
        data-testid="store-grid-empty"
        className="flex-1 border border-dashed border-black/20 rounded-xl p-12 text-center"
      >
        <p className="font-medium">{copy.grid.emptyTitle}</p>
        <p className="text-sm text-mist mt-1">{copy.grid.emptyBody}</p>
      </div>
    );
  }
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{copy.grid.featuredHeading}</h3>
        <span className="text-[10px] text-mist border border-hairline rounded px-1.5 py-0.5">
          {copy.stub.badge}
        </span>
      </div>
      <ul
        data-testid="store-grid"
        className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        {data.visibleTemplates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            installing={data.install.isPending && data.install.variables?.slug === t.slug}
            onInstall={() => data.install.mutate({ slug: t.slug })}
          />
        ))}
      </ul>
    </div>
  );
}

function TemplateCard({
  template,
  installing,
  onInstall,
}: {
  template: StoreTemplateDto;
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <li
      data-testid={`store-card-${template.slug}`}
      data-template-kind={template.kind}
      className="bg-ink rounded-2xl overflow-hidden shadow-lg flex flex-col group border border-white/10"
    >
      <div className="h-32 bg-white/5 relative p-4 flex items-center justify-center border-b border-white/10">
        <CardArt slug={template.slug} />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h4 className="text-white font-medium mb-2 truncate">{template.title}</h4>
        <p className="text-xs text-white/60 mb-4 leading-relaxed line-clamp-2">
          {template.summary}
        </p>
        <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-3">
          <div className="flex justify-between items-center">
            <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">
              {template.category}
            </span>
            <span className="text-[10px] text-white/40">
              {copy.grid.creatorLabel(template.creator)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-white/60">
              {copy.grid.employeesLabel(
                template.employees.length,
                template.downloadCount,
              )}
            </span>
            <button
              type="button"
              data-testid={`get-${template.slug}`}
              disabled={installing}
              onClick={onInstall}
              className="bg-white text-ink hover:bg-neutral-200 px-4 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {installing ? copy.grid.installingCta : copy.grid.getCta}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function CardArt({ slug }: { slug: string }) {
  // Tiny visual variation between cards without bringing in a real
  // illustration set — the prototype uses Phosphor icons; lucide-react's
  // closest approximations are fine.
  if (slug.includes("youtube") || slug.includes("media")) {
    return <Play className="size-10 text-white/30" strokeWidth={1.25} />;
  }
  return <Share2 className="size-10 text-white/30" strokeWidth={1.25} />;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function GridSkeleton() {
  return (
    <div
      data-testid="store-grid-skeleton"
      role="status"
      aria-busy="true"
      className="flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-64 bg-white/40 border border-hairline rounded-2xl animate-pulse"
        />
      ))}
    </div>
  );
}
