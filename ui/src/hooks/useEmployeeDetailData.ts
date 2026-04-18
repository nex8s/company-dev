import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { pluginIdentityApi, type VirtualCardDto } from "@/api/plugin-identity";
import { queryKeys } from "@/lib/queryKeys";
import { useCompanyShellData } from "@/hooks/useCompanyShellData";

/**
 * Per-agent data facade for the C-09 Employee Detail page.
 *
 * Live seams (wired today):
 *   - virtualCards — `GET /api/companies/:companyId/plugin-identity/agents/:agentId/cards`
 *     (B-13 + the plugin-identity router). `issueCard` and `freezeCard`
 *     are also wired; they invalidate the list on success.
 *
 * Stub seams (typed against the provider-mock shapes — swap points tagged
 * inline with the matching B-task):
 *   - inbox      — EmailProvider.listMessages (B-11 HTTP TBD)
 *   - browser    — BrowserProvider.{getLiveViewUrl,getSessionArtifacts} (B-12 HTTP TBD)
 *   - phone      — PhoneProvider (part of B-11 email/phone rollout)
 *   - compute    — A-07 per-agent budget endpoint
 *   - workspace  — Paperclip port (skills + attachments)
 *   - identity   — IdentityProvider.listForCompany (B-09 HTTP TBD)
 */

export interface EmployeeAgent {
  readonly id: string;
  readonly displayName: string;
  readonly department: "ceo" | "engineering" | "marketing" | "operations" | "sales" | "support";
  readonly statusLabel: string;
  readonly isCeo: boolean;
  readonly description: string;
  readonly email: string;
  readonly phone: string | null;
  readonly legalEntity: string | null;
}

export interface ComputeBreakdownRow {
  readonly label: string;
  readonly subtitle: string | null;
  readonly usageLabel: string;
  readonly credits: number;
}

export interface ComputeData {
  readonly currentPeriodCredits: number;
  readonly status: "idle" | "working" | "paused";
  readonly monthlyBudget: number | null;
  readonly resources: readonly ComputeBreakdownRow[];
}

export interface InboxMessage {
  readonly messageId: string;
  readonly fromAddress: string;
  readonly subject: string;
  readonly previewBody: string;
  readonly occurredAt: string;
  readonly direction: "inbound" | "outbound" | "internal";
}

export interface InboxData {
  readonly address: string;
  readonly messages: readonly InboxMessage[];
}

export interface BrowserArtifact {
  readonly artifactId: string;
  readonly kind: "screenshot" | "har" | "video" | "log";
  readonly url: string;
  readonly createdAt: string;
}

export interface BrowserData {
  readonly sessionStatus: "inactive" | "active" | "stopped";
  readonly liveViewUrl: string | null;
  readonly artifacts: readonly BrowserArtifact[];
}

export interface PhoneData {
  readonly number: string | null;
}

export interface WorkspaceData {
  readonly files: readonly { readonly name: string; readonly sizeLabel: string }[];
  readonly skills: readonly { readonly id: string; readonly name: string }[];
}

export interface EmployeeDetailData {
  readonly agent: EmployeeAgent | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly compute: ComputeData;
  readonly inbox: InboxData;
  readonly browser: BrowserData;
  readonly phone: PhoneData;
  readonly workspace: WorkspaceData;
  readonly virtualCards: {
    readonly cards: readonly VirtualCardDto[];
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly issueCard: UseMutationResult<unknown, ApiError, void>;
    readonly freezeCard: UseMutationResult<unknown, ApiError, { cardId: string }>;
  };
}

// TODO(A-07): swap for per-agent compute endpoint.
function buildComputeStub(isCeo: boolean): ComputeData {
  if (isCeo) {
    return {
      currentPeriodCredits: 0.3,
      status: "idle",
      monthlyBudget: null,
      resources: [
        {
          label: "AI inference",
          subtitle: "17.0k in · 2.2k out",
          usageLabel: "19.2k tokens",
          credits: 0.3,
        },
      ],
    };
  }
  return {
    currentPeriodCredits: 0,
    status: "idle",
    monthlyBudget: null,
    resources: [
      {
        label: "AI inference",
        subtitle: null,
        usageLabel: "0 tokens",
        credits: 0,
      },
    ],
  };
}

// TODO(B-11 HTTP): swap for EmailProvider.listMessages over HTTP.
function buildInboxStub(agent: EmployeeAgent): InboxData {
  const slug = agent.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    address: `${slug}@test-bff5c2.usecompanydev.com`,
    messages: [],
  };
}

// TODO(B-12 HTTP): swap for BrowserProvider HTTP route.
const BROWSER_STUB: BrowserData = {
  sessionStatus: "inactive",
  liveViewUrl: null,
  artifacts: [],
};

// TODO(B-11 HTTP): swap for PhoneProvider HTTP route.
const PHONE_STUB: PhoneData = { number: null };

// TODO(port): read skills + attachments from Paperclip's existing
// agent-skills + attachments APIs (already wired elsewhere in the app).
const WORKSPACE_STUB: WorkspaceData = { files: [], skills: [] };

export function findEmployeeAgent(
  shell: ReturnType<typeof useCompanyShellData>,
  agentId: string,
): EmployeeAgent | null {
  if (shell.ceo.id === agentId) {
    return {
      id: shell.ceo.id,
      displayName: shell.ceo.displayName,
      department: "ceo",
      statusLabel: shell.ceo.statusLabel,
      isCeo: true,
      description:
        "Company strategist. Handles all user communication, delegates tasks, reviews work, maintains strategy.",
      email: `${shell.ceo.displayName.toLowerCase()}@${shell.company.id}.company.dev`,
      phone: null,
      legalEntity: `${shell.company.name} Ops [LLC]`,
    };
  }
  for (const dept of shell.departments) {
    const hit = dept.agents.find((a) => a.id === agentId);
    if (hit) {
      return {
        id: hit.id,
        displayName: hit.displayName,
        department: dept.department,
        statusLabel: hit.statusLabel,
        isCeo: false,
        description: deptDescription(dept.department),
        email: `${hit.id}@${shell.company.id}.company.dev`,
        phone: null,
        legalEntity: null,
      };
    }
  }
  return null;
}

function deptDescription(
  dept: "engineering" | "marketing" | "operations" | "sales" | "support" | "ceo",
): string {
  switch (dept) {
    case "engineering":
      return "Website development, landing pages, and technical infrastructure.";
    case "marketing":
      return "Growth, campaigns, content, and community.";
    case "operations":
      return "Finance, legal, and back-office operations.";
    case "sales":
      return "Outbound, deal closing, and pipeline ownership.";
    case "support":
      return "Customer support, onboarding, and renewals.";
    case "ceo":
      return "Company strategist.";
  }
}

export function useEmployeeDetailData(
  companyId: string,
  agentId: string,
): EmployeeDetailData {
  const shell = useCompanyShellData(companyId);
  const queryClient = useQueryClient();

  const agent = useMemo(
    () => findEmployeeAgent(shell, agentId),
    [shell, agentId],
  );

  // Virtual cards — the only provider-backed tab with live HTTP today.
  const cardsQuery = useQuery({
    queryKey: queryKeys.pluginIdentity.agentCards(companyId, agentId),
    queryFn: () => pluginIdentityApi.listAgentCards(companyId, agentId),
    enabled:
      companyId.length > 0 && agentId.length > 0 && agent !== null && !agent.isCeo,
    staleTime: 10_000,
  });

  const cardsInvalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.pluginIdentity.agentCards(companyId, agentId),
    });
  };

  const issueCard = useMutation<unknown, ApiError, void>({
    mutationFn: () => pluginIdentityApi.issueAgentCard(companyId, agentId),
    onSuccess: cardsInvalidate,
  });
  const freezeCard = useMutation<unknown, ApiError, { cardId: string }>({
    mutationFn: ({ cardId }) =>
      pluginIdentityApi.freezeAgentCard(companyId, agentId, cardId),
    onSuccess: cardsInvalidate,
  });

  const compute = useMemo(
    () => buildComputeStub(agent?.isCeo ?? false),
    [agent?.isCeo],
  );
  const inbox = useMemo(
    () =>
      agent === null
        ? { address: "", messages: [] }
        : buildInboxStub(agent),
    [agent],
  );

  return {
    agent,
    isLoading: shell.isLoading,
    error: shell.error,
    compute,
    inbox,
    browser: BROWSER_STUB,
    phone: PHONE_STUB,
    workspace: WORKSPACE_STUB,
    virtualCards: {
      cards: cardsQuery.data?.cards ?? [],
      isLoading: cardsQuery.isLoading,
      error: (cardsQuery.error as Error | null) ?? null,
      issueCard,
      freezeCard,
    },
  };
}
