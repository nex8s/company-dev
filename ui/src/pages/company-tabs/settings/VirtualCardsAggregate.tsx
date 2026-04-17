import { useQueries } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { pluginIdentityApi } from "@/api/plugin-identity";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { queryKeys } from "@/lib/queryKeys";
import { useNavigate, useParams } from "@/lib/router";
import { useCompanyShellData } from "@/hooks/useCompanyShellData";
import { SubpageShell } from "./SubpageShell";

/**
 * Settings → Virtual Cards (C-12). The plugin-identity bank endpoints
 * are agent-scoped (no company-level list), so this page fans out one
 * query per agent and aggregates the results by agent. Issuing and
 * freezing cards happen on the individual agent's Virtual Cards tab
 * (C-09); this page is a read-only overview with per-agent drill-in.
 */
export function SettingsVirtualCards() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const shell = useCompanyShellData(companyId);

  // Every non-CEO agent in the company. CEO is excluded from card issuance
  // per the C-09 CEO-variant policy.
  const agents = shell.departments.flatMap((d) =>
    d.agents.map((a) => ({ id: a.id, displayName: a.displayName, department: d.department })),
  );

  const queries = useQueries({
    queries: agents.map((a) => ({
      queryKey: queryKeys.pluginIdentity.agentCards(companyId, a.id),
      queryFn: () => pluginIdentityApi.listAgentCards(companyId, a.id),
      enabled: companyId.length > 0,
    })),
  });

  const rows = agents.map((a, i) => ({
    agent: a,
    cards: queries[i].data?.cards ?? [],
    isLoading: queries[i].isLoading,
  }));

  const anyCards = rows.some((r) => r.cards.length > 0);

  return (
    <SubpageShell
      testId="settings-virtual-cards"
      heading={copy.virtualCards.heading}
    >
      <p className="text-sm text-mist">{copy.virtualCards.subheading}</p>
      {!anyCards && !rows.some((r) => r.isLoading) ? (
        <div
          data-testid="virtual-cards-empty"
          className="border border-dashed border-black/20 rounded-xl p-8 text-center"
        >
          <CreditCard className="size-8 text-mist mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-mist">{copy.virtualCards.empty}</p>
        </div>
      ) : (
        <ul
          data-testid="virtual-cards-agents"
          className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden"
        >
          {rows
            .filter((r) => r.cards.length > 0 || r.isLoading)
            .map(({ agent, cards, isLoading }) => (
              <li
                key={agent.id}
                data-testid={`agent-cards-${agent.id}`}
                className="px-4 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium">{agent.displayName}</p>
                  <p className="text-xs text-mist">
                    {isLoading ? "…" : copy.virtualCards.cardsLabel(cards.length)}{" "}
                    · {agent.department}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`open-agent-${agent.id}`}
                  onClick={() =>
                    navigate(`/c/${companyId}/team/${agent.id}/virtual-cards`)
                  }
                  className="text-xs text-mist hover:text-ink hover:bg-black/5 px-3 py-1.5 rounded-full border border-hairline"
                >
                  {copy.virtualCards.openAgentLabel} →
                </button>
              </li>
            ))}
        </ul>
      )}
    </SubpageShell>
  );
}
