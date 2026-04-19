import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowUp, Plus } from "lucide-react";
import { useParams } from "@/lib/router";
import { chat as copy } from "@/copy/chat";
import { useCompanyShellData } from "@/hooks/useCompanyShellData";
import {
  applyMention,
  detectMentionAt,
  filterMentionable,
  type ChatMessage,
  type MentionMatch,
  type MentionableAgent,
  useCompanyChat,
} from "@/hooks/useCompanyChat";

/**
 * Company > Chat — C-04. Index route of `/c/:companyId`.
 *
 * Pattern: single scroll region with the message list on top and a sticky
 * composer pinned to the bottom (gradient fade into the scroll). The
 * composer supports `@mention` autocomplete against the current
 * company's CEO + department agents, and system messages use the
 * "via check-in" label that A-06's run-lifecycle hook will produce.
 *
 * Data comes from `useCompanyChat(companyId, mentionable, currentUser)`
 * which today returns a local seed + stubbed agent reply on a 300 ms
 * delay. When A-06 merges, three swap points listed in useCompanyChat.ts
 * replace the stub. No render-code change is required.
 */
export function CompanyChat() {
  const { companyId = "" } = useParams<{ companyId: string }>();
  const shell = useCompanyShellData(companyId);
  const mentionable = useMentionableAgents(shell);
  const { messages, sendMessage, isStubReplyPending } = useCompanyChat({
    companyId,
    mentionable,
    currentUserDisplayName: shell.user.fullName,
  });

  return (
    <div
      data-testid="company-chat"
      className="relative flex-1 flex flex-col h-full overflow-hidden bg-white"
    >
      <MessageList messages={messages} isReplyPending={isStubReplyPending} />
      <Composer
        mentionable={mentionable}
        onSend={sendMessage}
        ceoName={shell.ceo.displayName}
      />
    </div>
  );
}

export default CompanyChat;

function useMentionableAgents(
  shell: ReturnType<typeof useCompanyShellData>,
): MentionableAgent[] {
  return useMemo(() => {
    const list: MentionableAgent[] = [
      { id: shell.ceo.id, displayName: shell.ceo.displayName, department: "ceo" },
    ];
    for (const dept of shell.departments) {
      for (const agent of dept.agents) {
        list.push({
          id: agent.id,
          displayName: agent.displayName,
          department: dept.department,
        });
      }
    }
    return list;
  }, [shell.ceo, shell.departments]);
}

// ---------------------------------------------------------------------------
// Message list
// ---------------------------------------------------------------------------

function MessageList({
  messages,
  isReplyPending,
}: {
  messages: readonly ChatMessage[];
  isReplyPending: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isReplyPending]);

  return (
    <div
      ref={scrollRef}
      data-testid="chat-messages"
      className="flex-1 overflow-y-auto p-6 pb-40 space-y-4"
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isReplyPending && <TypingIndicator />}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.author.kind === "user") {
    return <UserBubble message={message} />;
  }
  if (message.author.kind === "system") {
    return <SystemCheckInBubble message={message} />;
  }
  return <AgentBubble message={message} />;
}

function formatHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function UserBubble({ message }: { message: ChatMessage }) {
  if (message.author.kind !== "user") return null;
  return (
    <div className="flex justify-end pr-4" data-author="user">
      <div className="max-w-[70%]">
        <div className="text-[11px] text-mist mb-1 text-right flex justify-end gap-1 items-center">
          <span className="font-medium text-ink">{message.author.displayName}</span>
          <span>·</span>
          <span>{formatHHMM(message.createdAt)}</span>
        </div>
        <div className="bg-black text-white p-3.5 rounded-2xl rounded-tr-sm text-sm shadow-sm whitespace-pre-wrap">
          {message.body}
        </div>
      </div>
    </div>
  );
}

function AgentBubble({ message }: { message: ChatMessage }) {
  if (message.author.kind !== "agent") return null;
  return (
    <div className="flex items-end gap-2 pl-4" data-author="agent">
      <AgentAvatar />
      <div className="max-w-[70%]">
        <div className="text-[11px] text-mist mb-1 flex items-center gap-1">
          <span className="font-medium text-ink">
            {message.author.displayName}
          </span>
          <span>·</span>
          <span>{formatHHMM(message.createdAt)}</span>
        </div>
        <div className="bg-white border border-hairline shadow-sm p-3.5 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap">
          {message.body}
        </div>
      </div>
    </div>
  );
}

function SystemCheckInBubble({ message }: { message: ChatMessage }) {
  if (message.author.kind !== "system") return null;
  return (
    <div className="flex items-end gap-2 pl-4" data-author="system">
      <AgentAvatar />
      <div className="max-w-[70%]">
        <div className="text-[11px] text-mist mb-1 flex items-center gap-1">
          <span className="font-medium text-ink">
            {message.author.displayName}
          </span>
          <span>·</span>
          <span data-testid="via-check-in">{copy.viaCheckIn}</span>
          <span>·</span>
          <span>{formatHHMM(message.createdAt)}</span>
        </div>
        <div className="bg-white border border-hairline shadow-sm p-3.5 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap">
          {message.body}
        </div>
      </div>
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-cream border border-hairline flex items-center justify-center flex-shrink-0 mb-1">
      {/* Neutral placeholder mark — C-14 swaps for final Company.dev glyph. */}
      <svg width="14" height="10" viewBox="0 0 26 18" className="text-ink fill-current" aria-hidden="true">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="13" cy="5" r="1.5" />
        <circle cx="17" cy="5" r="1.5" />
        <circle cx="5" cy="9" r="1.5" />
        <circle cx="13" cy="9" r="1.5" />
        <circle cx="21" cy="9" r="1.5" />
        <circle cx="9" cy="13" r="1.5" />
        <circle cx="17" cy="13" r="1.5" />
      </svg>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 pl-4" data-testid="chat-typing">
      <AgentAvatar />
      <div className="bg-white border border-hairline shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm text-sm">
        <span className="inline-flex gap-1">
          <span className="w-1.5 h-1.5 bg-mist/60 rounded-full animate-pulse" />
          <span className="w-1.5 h-1.5 bg-mist/60 rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-mist/60 rounded-full animate-pulse [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer + mention popover
// ---------------------------------------------------------------------------

function Composer({
  mentionable,
  onSend,
  ceoName,
}: {
  mentionable: readonly MentionableAgent[];
  onSend: (body: string) => void;
  ceoName: string;
}) {
  const [value, setValue] = useState("");
  const [mention, setMention] = useState<MentionMatch | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filtered = useMemo(
    () => (mention ? filterMentionable(mentionable, mention.query) : []),
    [mention, mentionable],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [mention?.query]);

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      setValue(next);
      const caret = event.target.selectionStart ?? next.length;
      setMention(detectMentionAt(next, caret));
    },
    [],
  );

  const pickMention = useCallback(
    (agent: MentionableAgent) => {
      if (!mention) return;
      const { value: nextValue, nextCaret } = applyMention(value, mention, agent);
      setValue(nextValue);
      setMention(null);
      // Restore caret position after React re-renders.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
        }
      });
    },
    [mention, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mention && filtered.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((i) => (i + 1) % filtered.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          pickMention(filtered[selectedIndex]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setMention(null);
          return;
        }
      }
      if (event.key === "Enter" && !event.shiftKey && !mention) {
        event.preventDefault();
        submit();
      }
    },
    [filtered, mention, selectedIndex, pickMention],
  );

  const submit = useCallback(() => {
    if (value.trim().length === 0) return;
    onSend(value);
    setValue("");
    setMention(null);
  }, [onSend, value]);

  const handleFormSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-12 flex flex-col items-center pointer-events-none">
      <form
        onSubmit={handleFormSubmit}
        className="w-full max-w-3xl relative pointer-events-auto"
        data-testid="chat-composer"
      >
        {mention && filtered.length > 0 && (
          <MentionPopover
            items={filtered}
            selectedIndex={selectedIndex}
            onPick={pickMention}
          />
        )}
        <div className="bg-white border border-hairline shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] rounded-3xl flex items-end p-2 pl-4 pr-3">
          <button
            type="button"
            aria-label={copy.composer.attachLabel}
            className="p-1.5 text-mist hover:text-ink transition-colors shrink-0"
          >
            <Plus className="size-5" strokeWidth={2} />
          </button>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={copy.composer.placeholder}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm placeholder:text-mist resize-none min-h-[28px] max-h-32"
            data-testid="chat-textarea"
          />
          <button
            type="submit"
            aria-label={copy.composer.sendLabel}
            className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white hover:bg-neutral-800 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={value.trim().length === 0}
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-mist">
            {copy.tools.strip(ceoName)}
          </span>
        </div>
      </form>
    </div>
  );
}

function MentionPopover({
  items,
  selectedIndex,
  onPick,
}: {
  items: readonly MentionableAgent[];
  selectedIndex: number;
  onPick: (agent: MentionableAgent) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label={copy.mentionPopover.titleLabel}
      data-testid="mention-popover"
      className="absolute left-4 bottom-full mb-2 w-64 bg-white border border-hairline rounded-xl shadow-lg p-1 max-h-64 overflow-y-auto z-50"
    >
      {items.map((agent, i) => {
        const isActive = i === selectedIndex;
        return (
          <button
            key={agent.id}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => {
              // Prevent textarea blur before onClick fires.
              e.preventDefault();
              onPick(agent);
            }}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center justify-between ${
              isActive ? "bg-black/5" : "hover:bg-black/5"
            }`}
          >
            <span>{agent.displayName}</span>
            <span className="text-[10px] uppercase tracking-wide text-mist">
              {agent.department}
            </span>
          </button>
        );
      })}
    </div>
  );
}
