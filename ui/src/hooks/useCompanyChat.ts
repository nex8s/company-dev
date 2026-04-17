import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chat as chatCopy } from "@/copy/chat";

/**
 * Chat thread state for C-04. Today every message comes from a local seed
 * and user-sends produce a stubbed agent reply on a short delay. When A-06
 * (heartbeat/check-in system-message emitter) merges, three swap points
 * replace the stub:
 *
 *   1. `useChatMessages` → `useQuery({ queryKey: ['chat', companyId], ... })`
 *      fetching the company's backing issue thread (tickets/comments).
 *   2. The 300ms `setTimeout` reply is replaced by a WebSocket/SSE
 *      subscription that appends server-emitted messages (including "via
 *      check-in" system posts from A-06's run-lifecycle hook).
 *   3. `sendMessage` posts to the backend rather than mutating local state.
 *
 * All three are tagged `TODO(A-06)` in-file so the seam is grep-able.
 */

export type ChatAuthorKind = "user" | "agent" | "system";

export interface ChatAgentAuthor {
  kind: "agent";
  /** Stable agent id — e.g. `agent-ceo` — used for @mention matching. */
  id: string;
  /** Display name rendered in the bubble label. */
  displayName: string;
  /** "ceo" | "engineering" | "marketing" | … — source of the avatar flavor. */
  department: string;
}

export interface ChatUserAuthor {
  kind: "user";
  displayName: string;
}

export interface ChatSystemAuthor {
  kind: "system";
  /** Agent that emitted the check-in (usually the CEO). */
  displayName: string;
  via: "check-in";
}

export type ChatAuthor = ChatUserAuthor | ChatAgentAuthor | ChatSystemAuthor;

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  body: string;
  createdAt: Date;
}

export interface MentionableAgent {
  id: string;
  displayName: string;
  department: string;
}

export interface UseCompanyChatOptions {
  companyId: string;
  /** Agents the composer can @mention. */
  mentionable: readonly MentionableAgent[];
  currentUserDisplayName: string;
  /** Override for tests to make the stub reply deterministic. */
  replyDelayMs?: number;
}

export interface UseCompanyChatResult {
  messages: readonly ChatMessage[];
  sendMessage: (body: string) => void;
  isStubReplyPending: boolean;
}

// ---------------------------------------------------------------------------

function seedMessages(): ChatMessage[] {
  const base = new Date("2026-04-17T12:15:00Z").getTime();
  const at = (offsetMin: number) => new Date(base + offsetMin * 60_000);
  return [
    {
      id: "seed-1",
      author: {
        kind: "agent",
        id: "agent-gm",
        displayName: "Growth Marketer",
        department: "marketing",
      },
      body: chatCopy.seed.growthMarketerAck,
      createdAt: at(0),
    },
    {
      id: "seed-2",
      // TODO(A-06): this is a "via check-in" system message from the CEO.
      // A-06's run-lifecycle hook replaces it with a real post from the
      // agent-runtime error-recovery path.
      author: { kind: "system", displayName: "Naive", via: "check-in" },
      body: chatCopy.seed.ceoRecovery,
      createdAt: at(3),
    },
    {
      id: "seed-3",
      author: { kind: "agent", id: "agent-ceo", displayName: "Naive", department: "ceo" },
      body: chatCopy.seed.ceoFollowup,
      createdAt: at(3),
    },
    {
      id: "seed-4",
      author: { kind: "system", displayName: "Naive", via: "check-in" },
      body: chatCopy.seed.ceoResolution,
      createdAt: at(6),
    },
    {
      id: "seed-5",
      author: { kind: "system", displayName: "Naive", via: "check-in" },
      body: chatCopy.seed.ceoLpe,
      createdAt: at(8),
    },
  ];
}

export function useCompanyChat(options: UseCompanyChatOptions): UseCompanyChatResult {
  const { currentUserDisplayName, replyDelayMs = 300 } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(() => seedMessages());
  const [isStubReplyPending, setIsStubReplyPending] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback(
    (rawBody: string) => {
      const body = rawBody.trim();
      if (body.length === 0) return;
      const now = new Date();
      const userMsg: ChatMessage = {
        id: `user-${now.getTime()}`,
        author: { kind: "user", displayName: currentUserDisplayName },
        body,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStubReplyPending(true);

      // TODO(A-06): the stubbed setTimeout reply is a placeholder for the
      // real message-stream subscription. When the run-lifecycle emits a
      // response (or a "via check-in" system post), that arrives over the
      // same stream and replaces this mock.
      if (pendingTimer.current !== null) {
        clearTimeout(pendingTimer.current);
      }
      pendingTimer.current = setTimeout(() => {
        pendingTimer.current = null;
        const replyTime = new Date();
        const reply: ChatMessage = {
          id: `reply-${replyTime.getTime()}`,
          author: {
            kind: "agent",
            id: "agent-ceo",
            displayName: "Naive",
            department: "ceo",
          },
          body: chatCopy.stubReply(currentUserDisplayName),
          createdAt: replyTime,
        };
        setMessages((prev) => [...prev, reply]);
        setIsStubReplyPending(false);
      }, replyDelayMs);
    },
    [currentUserDisplayName, replyDelayMs],
  );

  return useMemo(
    () => ({ messages, sendMessage, isStubReplyPending }),
    [messages, sendMessage, isStubReplyPending],
  );
}

// ---------------------------------------------------------------------------
// Mention autocomplete helper — shared between composer + test.
// ---------------------------------------------------------------------------

export interface MentionMatch {
  /** Where the current `@query` starts in the textarea value. */
  triggerStart: number;
  /** Character-wise query after the `@`, lowercased for comparison. */
  query: string;
}

/**
 * Return the active `@query` substring anchored at the caret, if any.
 * Called on every composer input event to decide whether to show the
 * mention popover. Returns null when the caret isn't inside a mention.
 */
export function detectMentionAt(
  text: string,
  caret: number,
): MentionMatch | null {
  if (caret < 0 || caret > text.length) return null;
  // Walk back from the caret looking for the nearest @ that isn't
  // preceded by a word character (so emails like nicole@example.com
  // don't trigger).
  for (let i = caret - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === "@") {
      const prev = i === 0 ? " " : text[i - 1];
      if (/\s/.test(prev) || i === 0) {
        const query = text.slice(i + 1, caret);
        if (/\s/.test(query)) return null;
        return { triggerStart: i, query: query.toLowerCase() };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

export function filterMentionable(
  all: readonly MentionableAgent[],
  query: string,
): readonly MentionableAgent[] {
  const q = query.toLowerCase();
  if (q.length === 0) return all;
  return all.filter((a) => a.displayName.toLowerCase().includes(q));
}

export function applyMention(
  text: string,
  match: MentionMatch,
  agent: MentionableAgent,
): { value: string; nextCaret: number } {
  const before = text.slice(0, match.triggerStart);
  const afterCaret = text.slice(match.triggerStart + 1 + match.query.length);
  const token = `@${agent.displayName} `;
  const value = `${before}${token}${afterCaret}`;
  return { value, nextCaret: before.length + token.length };
}
