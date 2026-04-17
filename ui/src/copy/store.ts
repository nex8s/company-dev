/**
 * Store view copy — `ui/src/pages/Store.tsx` (C-08).
 *
 * The category lists are intentionally hard-coded here (rather than
 * derived from the templates payload) so the filter rail is stable when
 * a category has zero templates today. New seeds pick up an existing
 * label automatically; truly new labels need a one-line edit here.
 */

export const store = {
  page: {
    title: "Store Templates",
    subtitle:
      "Download AI employees and businesses, customize them to your needs, and build them up into something entirely yours.",
  },
  segment: {
    all: "All",
    businesses: "Businesses",
    employees: "Employees",
    myProfile: "My Profile",
  },
  rail: {
    businessHeading: "Business Categories",
    employeeHeading: "Employee Departments",
    allBusinesses: "All Businesses",
    allEmployees: "All Employees",
  },
  // Categories shown in the rail. Mirrors `ui-import/dashboard.html` Store
  // section. The seed templates' `category` field is matched against these
  // strings; a template whose category is not in this list still renders
  // (under "All") so the typo doesn't drop it from the grid.
  businessCategories: [
    "Agency & Services",
    "E-Commerce & DTC",
    "Media & Content",
    "SaaS & Tech",
    "Professional Services",
    "Local & Physical",
    "Data & Analytics",
    "Sales & Revenue",
    "Engineering & Product",
    "Marketing & Growth",
  ],
  employeeDepartments: [
    "Marketing & Growth",
    "Sales & Revenue",
    "Engineering & Product",
    "Operations & Finance",
    "Data & Analytics",
  ],
  grid: {
    featuredHeading: "Featured",
    emptyTitle: "No templates match this filter",
    emptyBody: "Try clearing the category filter or switching segments.",
    error: "Couldn't load templates.",
    loading: "Loading templates…",
    employeesLabel: (n: number, downloads: number) =>
      `${n} ${n === 1 ? "employee" : "employees"} · ${formatDownloads(downloads)}`,
    creatorLabel: (creator: string) => `By ${creator}`,
    getCta: "Get",
    installingCta: "Installing…",
  },
  install: {
    successTitle: "Installed",
    failureFallback: "Install failed — try again.",
  },
  stub: {
    badge: "stub · plugin-store HTTP (TBD)",
    note:
      "Templates and the install flow read live from B-04 / B-05's in-process contract via a typed mock. When the plugin-store HTTP routes mount, swap the seed array for `pluginStoreApi.listTemplates()` and the install handler for `pluginStoreApi.installTemplate()`.",
  },
} as const;

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export type StoreCopy = typeof store;
