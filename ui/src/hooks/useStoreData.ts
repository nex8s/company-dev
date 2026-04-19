import { useEffect, useMemo, useState } from "react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import type {
  InstallTemplateBody,
  InstallTemplateResponse,
  StoreTemplateDto,
} from "@/api/plugin-store";

/**
 * C-08 Store data facade.
 *
 * Today the templates list and the install flow are both typed mocks
 * (the data is hand-mirrored from `packages/plugin-store/src/seeds/*`,
 * the install function builds an `InstallTemplateResponse` shaped
 * exactly like the real `installTemplate` transaction). Plugin-store
 * has no HTTP routes mounted yet (see `ui/src/api/plugin-store.ts`
 * header). When those routes ship:
 *
 *   1. Replace `MOCK_TEMPLATES` below with `useQuery(...)` against
 *      `pluginStoreApi.listTemplates()`.
 *   2. Replace `mockInstall` with `pluginStoreApi.installTemplate(body)`.
 *
 * No component-side change is required — the page reads the same
 * `templates` + `install` shape either way.
 */

export type SegmentFilter = "all" | "business" | "employee";

export interface StoreData {
  readonly templates: readonly StoreTemplateDto[];
  readonly visibleTemplates: readonly StoreTemplateDto[];
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly install: UseMutationResult<
    InstallTemplateResponse,
    ApiError,
    InstallTemplateBody
  >;
}

// ---------------------------------------------------------------------------
// Mock templates — hand-mirrored from packages/plugin-store/src/seeds/*.ts
// (B-04). Categories and employee counts match the seeds; downloadCount is
// padded with prototype-display numbers since the seed defaults all to 0.
// ---------------------------------------------------------------------------

const ISO = "2026-04-15T00:00:00.000Z";

const MOCK_TEMPLATES: readonly StoreTemplateDto[] = [
  {
    id: "tpl-faceless-youtube",
    slug: "faceless-youtube",
    kind: "business",
    title: "Faceless YouTube Empire",
    category: "Media & Content",
    summary:
      "Complete automated content pipeline for generating, scripting, and managing a faceless YT channel.",
    skills: [],
    employees: [
      { role: "Topic Researcher", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
      { role: "Scriptwriter", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
      { role: "Video Producer", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
      { role: "Channel Operator", department: "operations", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 8400,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: "tpl-smma",
    slug: "smma",
    kind: "business",
    title: "SMMA (Social Media Marketing)",
    category: "Agency & Services",
    summary:
      "Agency in a box. Outbound sales agent paired with a social media manager and content creator.",
    skills: [],
    employees: [
      { role: "Prospector", department: "sales", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
      { role: "Account Strategist", department: "sales", model: "claude-opus-4-6", schedule: "per-client", responsibilities: [] },
      { role: "Content Producer", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 5200,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: "tpl-youtube-long-form",
    slug: "youtube-long-form",
    kind: "business",
    title: "YouTube Long-Form Producer",
    category: "Marketing & Growth",
    summary:
      "Research, outline, and script deep-dive video essays with embedded SEO optimization structure.",
    skills: [],
    employees: [
      { role: "Researcher", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
      { role: "Outliner", department: "marketing", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 3100,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: "tpl-b2b-outbound",
    slug: "b2b-outbound-machine",
    kind: "business",
    title: "B2B Outbound Machine",
    category: "Sales & Revenue",
    summary:
      "ICP-targeted outbound team — researcher, copywriter, SDR, and CRM ops on a coordinated cadence.",
    skills: [],
    employees: [
      { role: "Researcher", department: "sales", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
      { role: "Copywriter", department: "sales", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
      { role: "SDR", department: "sales", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
      { role: "CRM Ops", department: "operations", model: "claude-sonnet-4-6", schedule: "daily", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 4700,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: "tpl-dev-agency",
    slug: "dev-agency",
    kind: "business",
    title: "Dev Agency",
    category: "Agency & Services",
    summary:
      "Senior engineer + project manager pair to take a brief from spec to deployed app on a delivery cadence.",
    skills: [],
    employees: [
      { role: "Senior Engineer", department: "engineering", model: "claude-opus-4-6", schedule: "per-project", responsibilities: [] },
      { role: "Project Manager", department: "operations", model: "claude-sonnet-4-6", schedule: "weekly", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 2100,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: "tpl-devops-monitoring",
    slug: "devops-monitoring-ops",
    kind: "business",
    title: "DevOps Monitoring Ops",
    category: "Engineering & Product",
    summary:
      "Always-on incident-response and observability team — monitors, escalates, and resolves on rotation.",
    skills: [],
    employees: [
      { role: "On-Call Engineer", department: "engineering", model: "claude-sonnet-4-6", schedule: "rotation", responsibilities: [] },
      { role: "Observability Lead", department: "engineering", model: "claude-opus-4-6", schedule: "weekly", responsibilities: [] },
      { role: "Incident Commander", department: "operations", model: "claude-sonnet-4-6", schedule: "on-incident", responsibilities: [] },
    ],
    creator: "Company.dev",
    downloadCount: 1300,
    createdAt: ISO,
    updatedAt: ISO,
  },
];

// TODO(plugin-store HTTP): swap for `pluginStoreApi.installTemplate(body)`.
// The mocked installation simulates a successful transactional install
// and returns the same shape the real route will, so the calling code
// (navigate to `/c/:companyId`) doesn't need to change.
async function mockInstall(body: InstallTemplateBody): Promise<InstallTemplateResponse> {
  // Tiny delay so the button shows its pending state.
  await new Promise((r) => setTimeout(r, 50));
  const slug = body.slug;
  // Deterministic stand-in id derived from the slug — easy to assert in tests.
  const stamp = Date.now().toString(36);
  return {
    companyId: `installed-${slug}-${stamp}`,
    companyProfileId: `profile-${slug}-${stamp}`,
    ceoAgentId: `ceo-${slug}-${stamp}`,
    hiredAgentIds: [],
    installationId: `inst-${slug}-${stamp}`,
  };
}

export interface UseStoreDataOptions {
  readonly segment: SegmentFilter;
  /** When set, only templates with this category are returned. */
  readonly category: string | null;
  readonly onInstalled?: (result: InstallTemplateResponse) => void;
}

export function useStoreData({
  segment,
  category,
  onInstalled,
}: UseStoreDataOptions): StoreData {
  // Try real API first, fall back to mock templates
  const [templates, setTemplates] = useState<readonly StoreTemplateDto[]>(MOCK_TEMPLATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try the plugin-store API
        const res = await fetch("/api/plugin-store/templates");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setTemplates(data);
          }
        }
      } catch {}
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const visibleTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (segment === "business" && t.kind !== "business") return false;
      if (segment === "employee" && t.kind !== "employee") return false;
      if (category && t.category !== category) return false;
      return true;
    });
  }, [templates, segment, category]);

  const install = useMutation<InstallTemplateResponse, ApiError, InstallTemplateBody>({
    mutationFn: (body) => mockInstall(body),
    onSuccess: (result) => {
      onInstalled?.(result);
    },
  });

  return {
    templates,
    visibleTemplates,
    isLoading,
    error: null,
    install,
  };
}
