import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { ApiError } from "@/api/client";
import { accessApi, type CompanyMemberDto } from "@/api/access";
import { settingsSubpages as copy } from "@/copy/settings-subpages";
import { queryKeys } from "@/lib/queryKeys";
import { useParams } from "@/lib/router";
import { SubpageShell } from "./SubpageShell";
import type { JoinRequest } from "@paperclipai/shared";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SettingsTeam() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: queryKeys.companyAccess.members(companyId),
    queryFn: () => accessApi.listCompanyMembers(companyId),
    enabled: companyId.length > 0,
  });

  const joinRequestsQuery = useQuery({
    queryKey: queryKeys.access.joinRequests(companyId),
    queryFn: () => accessApi.listJoinRequests(companyId),
    enabled: companyId.length > 0,
  });

  const invalidateRequests = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.access.joinRequests(companyId),
    });

  const inviteMutation = useMutation<unknown, ApiError, { email: string }>({
    mutationFn: () =>
      accessApi.createCompanyInvite(companyId, {
        allowedJoinTypes: "human",
        // The server wires the email into the invite manifest; no
        // dedicated `email` body field exists today so we stash it in
        // `agentMessage` as a readable note for the recipient.
        agentMessage: `Invite for ${email}`,
      }),
    onSuccess: () => {
      setEmail("");
      setLocalError(null);
    },
  });

  const approveMutation = useMutation<unknown, ApiError, { requestId: string }>({
    mutationFn: ({ requestId }) =>
      accessApi.approveJoinRequest(companyId, requestId),
    onSuccess: invalidateRequests,
  });
  const rejectMutation = useMutation<unknown, ApiError, { requestId: string }>({
    mutationFn: ({ requestId }) =>
      accessApi.rejectJoinRequest(companyId, requestId),
    onSuccess: invalidateRequests,
  });

  const handleInvite = () => {
    if (!EMAIL_RE.test(email)) {
      setLocalError(copy.team.invalidEmail);
      return;
    }
    setLocalError(null);
    inviteMutation.mutate({ email });
  };

  return (
    <SubpageShell testId="settings-team" heading={copy.team.heading}>
      <section data-testid="team-invite" className="bg-white border border-hairline rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mist">
          {copy.team.inviteHeading}
        </h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            data-testid="team-invite-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.team.inviteEmailLabel}
            className="flex-1 bg-cream border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <button
            type="button"
            data-testid="team-invite-submit"
            disabled={inviteMutation.isPending || email.length === 0}
            onClick={handleInvite}
            className="bg-ink text-white hover:bg-neutral-800 px-4 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-40"
          >
            <UserPlus className="size-3" strokeWidth={2} />
            {inviteMutation.isPending ? copy.team.inviting : copy.team.inviteSubmit}
          </button>
        </div>
        {localError && (
          <p data-testid="team-invite-error" className="text-xs text-red-600" role="alert">
            {localError}
          </p>
        )}
      </section>

      <section data-testid="team-pending" className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mist">
          {copy.team.pendingHeading}
        </h3>
        {joinRequestsQuery.isLoading ? (
          <div className="h-16 bg-white border border-hairline rounded-xl animate-pulse" />
        ) : (joinRequestsQuery.data?.length ?? 0) === 0 ? (
          <p data-testid="team-pending-empty" className="text-sm text-mist">
            {copy.team.pendingEmpty}
          </p>
        ) : (
          <ul className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden">
            {joinRequestsQuery.data?.map((r) => (
              <JoinRequestRow
                key={r.id}
                request={r}
                onApprove={() => approveMutation.mutate({ requestId: r.id })}
                onReject={() => rejectMutation.mutate({ requestId: r.id })}
                pending={approveMutation.isPending || rejectMutation.isPending}
              />
            ))}
          </ul>
        )}
      </section>

      <section data-testid="team-members" className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-mist">
          {copy.team.membersHeading}
        </h3>
        {membersQuery.isLoading ? (
          <div className="h-32 bg-white border border-hairline rounded-xl animate-pulse" />
        ) : (membersQuery.data?.length ?? 0) === 0 ? (
          <p data-testid="team-members-empty" className="text-sm text-mist">
            {copy.team.membersEmpty}
          </p>
        ) : (
          <ul className="bg-white border border-hairline rounded-xl divide-y divide-hairline overflow-hidden">
            {membersQuery.data?.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        )}
      </section>
    </SubpageShell>
  );
}

function MemberRow({ member }: { member: CompanyMemberDto }) {
  return (
    <li
      data-testid={`member-row-${member.id}`}
      className="px-4 py-3 flex items-center justify-between text-sm"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{member.displayName}</p>
        <p className="text-xs text-mist truncate">
          {member.email ?? "—"} · {copy.team.joinedAt(member.joinedAt)}
        </p>
      </div>
      <span className="text-[10px] text-mist border border-hairline rounded px-2 py-0.5">
        {member.memberType === "agent" ? copy.team.agentBadge : copy.team.humanBadge}
      </span>
    </li>
  );
}

function JoinRequestRow({
  request,
  onApprove,
  onReject,
  pending,
}: {
  request: JoinRequest;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  return (
    <li
      data-testid={`join-request-row-${request.id}`}
      className="px-4 py-3 flex items-center justify-between text-sm"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">
          {request.requestType === "agent" ? copy.team.agentBadge : copy.team.humanBadge}
        </p>
        <p className="text-xs text-mist truncate">{request.id}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid={`join-request-reject-${request.id}`}
          disabled={pending}
          onClick={onReject}
          className="text-xs border border-hairline text-mist hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-full disabled:opacity-40"
        >
          {copy.team.rejectCta}
        </button>
        <button
          type="button"
          data-testid={`join-request-approve-${request.id}`}
          disabled={pending}
          onClick={onApprove}
          className="text-xs bg-ink text-white hover:bg-neutral-800 px-3 py-1.5 rounded-full disabled:opacity-40"
        >
          {copy.team.approveCta}
        </button>
      </div>
    </li>
  );
}
