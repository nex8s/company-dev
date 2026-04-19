/**
 * Company > Chat view copy — user-facing strings for
 * `ui/src/pages/CompanyChat.tsx`.
 *
 * System messages tagged "via check-in" come from A-06 once it lands; the
 * phrase lives here so the C-14 brand-swap can audit one file.
 */

export const chat = {
  composer: {
    placeholder:
      "Ask a follow-up or start a new plan… · Type @ to mention a teammate",
    attachLabel: "Attach a file",
    sendLabel: "Send",
    mentionPrefix: "@",
  },

  mentionPopover: {
    emptyLabel: "No teammates match",
    titleLabel: "Mention a teammate",
  },

  tools: {
    // Brand footer below the composer — always shows the product name.
    strip: (_ceoName: string) => `Connect your tools to Company.dev`,
  },

  viaCheckIn: "via check-in",
  nowLabel: "Just now",

  // TODO(A-06): the initial message seed below is a placeholder. When A-06's
  // heartbeat/check-in stream emits into the company chat thread, this hook
  // subscribes to the stream and the seed becomes the initial page of the
  // thread from the tickets API.
  seed: {
    growthMarketerAck:
      'Got it — working on "Create GTM Plan for company x" now.',
    ceoRecovery:
      "Growth Marketer hit a transient server issue while working on the first blog post. I've restarted them — they'll pick up where they left off on their next heartbeat.",
    ceoFollowup: "I'll check the Growth Marketer's status and get them back on track.",
    ceoResolution:
      "Growth Marketer is back online. The server restart was a transient issue — the agent will retry automatically on its next heartbeat. Their content calendar is in review, and they have two more tasks queued (GTM plan and first blog post).",
    ceoLpe:
      "Landing Page Engineer is back online — the server restart caused a transient error. They'll automatically retry their task on the next heartbeat.",
  },

  stubReply: (you: string) =>
    `Thanks ${you} — I'll pick that up on the next heartbeat and loop back with a check-in.`,
};

export type ChatCopy = typeof chat;
