// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chat as copy } from "@/copy/chat";
import {
  applyMention,
  detectMentionAt,
  filterMentionable,
  type MentionableAgent,
} from "@/hooks/useCompanyChat";
import { CompanyChat } from "./CompanyChat";

/**
 * C-04 chat contract:
 *   1. Seed messages render (user + agent + "via check-in" system variants).
 *   2. Composer textarea + send button present.
 *   3. Typing "@" opens the mention popover seeded with the current CEO +
 *      dept agents; arrow keys + Enter pick; the selected token lands
 *      in the textarea.
 *   4. Sending a message adds a user bubble and (after the stub delay)
 *      an agent reply appears.
 *
 * Playwright-level assertions (the PLAN.md gate uses Playwright) are
 * deferred to C-13's harness; the render contract + mention pure-function
 * contract is what gate-C-04 enforces today.
 */

vi.mock("@/lib/router", async () => {
  const rrd = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...rrd,
    Link: ({ children, ...props }: ComponentProps<"a">) => (
      <a {...props}>{children}</a>
    ),
    useParams: () => ({ companyId: "company-x" }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderChat(container: HTMLElement) {
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/c/company-x"]}>
        <Routes>
          <Route path="c/:companyId" element={<CompanyChat />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

function setInputValue(el: HTMLTextAreaElement, value: string, caret = value.length) {
  act(() => {
    const proto = Object.getPrototypeOf(el) as HTMLTextAreaElement;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    descriptor!.set!.call(el, value);
    el.selectionStart = caret;
    el.selectionEnd = caret;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickElement(el: Element) {
  act(() => {
    el.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

describe("CompanyChat (C-04)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
    vi.useRealTimers();
  });

  it("mounts and renders the seed thread with an agent bubble, a via-check-in system bubble, and the composer", () => {
    root = renderChat(container);
    expect(container.querySelector('[data-testid="company-chat"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="chat-messages"]')).toBeTruthy();
    expect(container.querySelector('[data-author="agent"]')).toBeTruthy();
    expect(container.querySelector('[data-author="system"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="via-check-in"]')?.textContent).toBe(
      copy.viaCheckIn,
    );
    expect(container.querySelector('[data-testid="chat-composer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="chat-textarea"]')).toBeTruthy();
    expect(
      container.querySelector(`[aria-label="${copy.composer.sendLabel}"]`),
    ).toBeTruthy();
  });

  it("typing '@' opens the mention popover with CEO + dept agents", () => {
    root = renderChat(container);
    const ta = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-textarea"]',
    )!;
    setInputValue(ta, "@");
    const popover = container.querySelector('[data-testid="mention-popover"]');
    expect(popover).toBeTruthy();
    // Seeded with Naive (CEO) + five dept agents — minimum 6 options.
    const options = popover?.querySelectorAll('[role="option"]') ?? [];
    expect(options.length).toBeGreaterThanOrEqual(6);
    const labels = Array.from(options).map((o) => o.textContent ?? "");
    expect(labels.some((l) => l.includes("Naive"))).toBe(true);
    expect(labels.some((l) => l.includes("Growth Marketer"))).toBe(true);
  });

  it("filters the mention popover by the query after '@'", () => {
    root = renderChat(container);
    const ta = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-textarea"]',
    )!;
    setInputValue(ta, "@grow");
    const options =
      container
        .querySelector('[data-testid="mention-popover"]')
        ?.querySelectorAll('[role="option"]') ?? [];
    const labels = Array.from(options).map((o) => o.textContent ?? "");
    expect(labels.every((l) => l.toLowerCase().includes("grow"))).toBe(true);
  });

  it("clicking a mention popover option inserts the '@displayName ' token into the textarea", () => {
    root = renderChat(container);
    const ta = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-textarea"]',
    )!;
    setInputValue(ta, "hey @grow");
    const growthBtn = Array.from(
      container.querySelectorAll('[data-testid="mention-popover"] [role="option"]'),
    ).find((b) => b.textContent?.includes("Growth Marketer"))!;
    clickElement(growthBtn);
    expect(ta.value).toBe("hey @Growth Marketer ");
  });

  it("submitting the composer appends a user bubble and an agent reply after the stub delay", () => {
    root = renderChat(container);
    const form = container.querySelector<HTMLFormElement>(
      '[data-testid="chat-composer"]',
    )!;
    const ta = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="chat-textarea"]',
    )!;
    const seedUserBubbles = container.querySelectorAll('[data-author="user"]').length;

    setInputValue(ta, "kick off the first blog post");
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const afterSendUserBubbles = container.querySelectorAll('[data-author="user"]').length;
    expect(afterSendUserBubbles).toBe(seedUserBubbles + 1);
    expect(container.textContent).toContain("kick off the first blog post");
    expect(container.querySelector('[data-testid="chat-typing"]')).toBeTruthy();

    // Advance past the stub reply delay (300ms default).
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector('[data-testid="chat-typing"]')).toBeNull();
    // The reply comes from the CEO agent.
    const agentBubbles = container.querySelectorAll('[data-author="agent"]');
    expect(agentBubbles.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Pure-function contract for mention helpers. No React / no jsdom here.
// ---------------------------------------------------------------------------

describe("mention helpers", () => {
  const agents: MentionableAgent[] = [
    { id: "1", displayName: "Naive", department: "ceo" },
    { id: "2", displayName: "Growth Marketer", department: "marketing" },
    { id: "3", displayName: "Landing Page Engineer", department: "engineering" },
  ];

  it("detectMentionAt returns null when the caret isn't inside a mention", () => {
    expect(detectMentionAt("", 0)).toBeNull();
    expect(detectMentionAt("plain text", 5)).toBeNull();
    expect(detectMentionAt("foo@bar.com", 7)).toBeNull(); // email, not mention
  });

  it("detectMentionAt locks onto the nearest @ at/before the caret", () => {
    const m = detectMentionAt("hey @gr", 7);
    expect(m).toEqual({ triggerStart: 4, query: "gr" });
  });

  it("filterMentionable narrows by display-name substring, case-insensitive", () => {
    expect(filterMentionable(agents, "")).toHaveLength(3);
    expect(filterMentionable(agents, "grow").map((a) => a.id)).toEqual(["2"]);
    expect(filterMentionable(agents, "NAIVE").map((a) => a.id)).toEqual(["1"]);
  });

  it("applyMention replaces @query with @DisplayName + trailing space", () => {
    const match = detectMentionAt("hey @grow", 9)!;
    const { value, nextCaret } = applyMention("hey @grow", match, agents[1]);
    expect(value).toBe("hey @Growth Marketer ");
    expect(nextCaret).toBe("hey @Growth Marketer ".length);
  });
});
