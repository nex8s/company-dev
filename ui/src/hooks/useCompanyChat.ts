import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chat as chatCopy } from "@/copy/chat";

/**
 * Chat thread state for C-04, now wired to Paperclip's issue/comment API.
 *
 * Flow:
 *   1. On mount, find or create a backing issue for the company chat.
 *   2. Fetch comments from that issue → render as messages.
 *   3. User sends → POST comment → refetch.
 *   4. Poll every 3s for new comments (real-time WebSocket is Phase 2).
 */

export type ChatAuthorKind = "user" | "agent" | "system";

export interface ChatAgentAuthor {
  kind: "agent";
  id: string;
  displayName: string;
  department: string;
}

export interface ChatUserAuthor {
  kind: "user";
  displayName: string;
}

export interface ChatSystemAuthor {
  kind: "system";
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
  mentionable: readonly MentionableAgent[];
  currentUserDisplayName: string;
  replyDelayMs?: number;
}

export interface UseCompanyChatResult {
  messages: readonly ChatMessage[];
  sendMessage: (body: string) => void;
  isStubReplyPending: boolean;
}

// ---------------------------------------------------------------------------
// Backing issue management — one persistent chat issue per company
// ---------------------------------------------------------------------------

const CHAT_ISSUE_KEY_PREFIX = "company.chat.issueId.";
const _issuePromiseCache = new Map<string, Promise<string | null>>();

async function getOrCreateChatIssue(companyId: string): Promise<string | null> {
  // Deduplicate concurrent calls for the same company
  const cached = _issuePromiseCache.get(companyId);
  if (cached) return cached;
  const promise = _getOrCreateChatIssueInner(companyId);
  _issuePromiseCache.set(companyId, promise);
  return promise;
}

async function _getOrCreateChatIssueInner(companyId: string): Promise<string | null> {
  const storageKey = `${CHAT_ISSUE_KEY_PREFIX}${companyId}`;
  const cached = localStorage.getItem(storageKey);

  // Verify cached issue still exists
  if (cached) {
    try {
      const res = await fetch(`/api/issues/${cached}`);
      if (res.ok) return cached;
    } catch {}
    localStorage.removeItem(storageKey);
  }

  // Find existing issues for this company
  try {
    const res = await fetch(`/api/companies/${companyId}/issues?limit=50`);
    if (res.ok) {
      const issues = await res.json();
      if (Array.isArray(issues) && issues.length > 0) {
        // Use the first active issue as the chat backing
        const active = issues.find((i: any) => i.status !== "done" && i.status !== "archived");
        const issueId = active?.id || issues[0].id;
        localStorage.setItem(storageKey, issueId);
        return issueId;
      }
    }
  } catch {}

  // Create a new chat issue
  try {
    const res = await fetch(`/api/companies/${companyId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Company Chat",
        description: "Persistent chat thread for this company.",
      }),
    });
    if (res.ok) {
      const issue = await res.json();
      localStorage.setItem(storageKey, issue.id);
      return issue.id;
    }
  } catch {}

  return null;
}

// ---------------------------------------------------------------------------
// Comment → ChatMessage mapper
// ---------------------------------------------------------------------------

function commentToMessage(comment: any): ChatMessage {
  let author: ChatAuthor;
  if (comment.authorType === "agent" || comment.agentId) {
    const isCheckIn = comment.body?.includes("via check-in") ||
                      comment.metadata?.via === "check-in";
    if (isCheckIn) {
      author = {
        kind: "system",
        displayName: comment.authorName || comment.agentName || "Naive",
        via: "check-in",
      };
    } else {
      author = {
        kind: "agent",
        id: comment.agentId || comment.authorId || "unknown",
        displayName: comment.authorName || comment.agentName || "Agent",
        department: comment.metadata?.department || "ceo",
      };
    }
  } else {
    author = {
      kind: "user",
      displayName: comment.authorName || "You",
    };
  }

  return {
    id: comment.id,
    author,
    body: comment.body || "",
    createdAt: new Date(comment.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompanyChat(options: UseCompanyChatOptions): UseCompanyChatResult {
  const { companyId, currentUserDisplayName } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [isStubReplyPending, setIsStubReplyPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve backing issue on mount
  useEffect(() => {
    let cancelled = false;
    getOrCreateChatIssue(companyId).then((id) => {
      if (!cancelled && id) setIssueId(id);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  // Fetch comments when issueId is resolved, then poll every 3s
  const fetchComments = useCallback(async () => {
    if (!issueId) return;
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`);
      if (res.ok) {
        const comments = await res.json();
        if (Array.isArray(comments)) {
          setMessages(comments.map(commentToMessage));
        }
      }
    } catch {}
  }, [issueId]);

  useEffect(() => {
    if (!issueId) return;
    fetchComments();
    pollRef.current = setInterval(fetchComments, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [issueId, fetchComments]);

  const sendMessage = useCallback(
    async (rawBody: string) => {
      const body = rawBody.trim();
      if (body.length === 0 || !issueId) return;

      // Optimistic local add
      const now = new Date();
      const userMsg: ChatMessage = {
        id: `user-${now.getTime()}`,
        author: { kind: "user", displayName: currentUserDisplayName },
        body,
        createdAt: now,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStubReplyPending(true);

      // POST to the real API
      try {
        await fetch(`/api/issues/${issueId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
      } catch {
        // Comment failed — the optimistic message stays for now
      }

      // Refetch after a beat to pick up the server-side comment + any agent reply
      setTimeout(() => {
        fetchComments();
        setIsStubReplyPending(false);
      }, 1000);
    },
    [issueId, currentUserDisplayName, fetchComments],
  );

  return useMemo(
    () => ({ messages, sendMessage, isStubReplyPending }),
    [messages, sendMessage, isStubReplyPending],
  );
}

// ---------------------------------------------------------------------------
// Mention autocomplete helper
// ---------------------------------------------------------------------------

export interface MentionMatch {
  triggerStart: number;
  query: string;
}

export function detectMentionAt(text: string, caret: number): MentionMatch | null {
  if (caret < 0 || caret > text.length) return null;
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
