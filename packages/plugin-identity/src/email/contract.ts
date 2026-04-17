import { describe, it, expect } from "vitest";
import type { EmailProvider } from "./provider.js";

export type EmailProviderFactory = () => EmailProvider | Promise<EmailProvider>;

/**
 * Shared contract every EmailProvider implementation must satisfy.
 * Apply from each impl's *.contract.test.ts via `runEmailProviderContract(...)`.
 */
export function runEmailProviderContract(
  label: string,
  factory: EmailProviderFactory,
): void {
  describe(`EmailProvider contract · ${label}`, () => {
    it("provisionInbox returns the UI response shape with a composed address", async () => {
      const provider = await factory();
      const inbox = await provider.provisionInbox({
        companyId: "11111111-1111-1111-1111-111111111111",
        agentId: "agent-alpha",
      });

      expect(inbox).toMatchObject({
        inboxId: expect.any(String),
        companyId: "11111111-1111-1111-1111-111111111111",
        agentId: "agent-alpha",
        address: expect.any(String),
        domain: expect.any(String),
        localPart: expect.any(String),
      });
      expect(inbox.createdAt).toBeInstanceOf(Date);
      expect(inbox.address).toBe(`${inbox.localPart}@${inbox.domain}`);
    });

    it("provisionInbox honours explicit domain + localPart", async () => {
      const provider = await factory();
      const inbox = await provider.provisionInbox({
        companyId: "22222222-2222-2222-2222-222222222222",
        agentId: "agent-beta",
        domain: "acme.test",
        localPart: "beta",
      });
      expect(inbox.domain).toBe("acme.test");
      expect(inbox.localPart).toBe("beta");
      expect(inbox.address).toBe("beta@acme.test");
    });

    it("provisionInbox is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      const input = {
        companyId: "33333333-3333-3333-3333-333333333333",
        agentId: "agent-gamma",
        idempotencyKey: "inbox-key-1",
      };
      const first = await provider.provisionInbox(input);
      const second = await provider.provisionInbox(input);
      expect(second.inboxId).toBe(first.inboxId);
    });

    it("sendEmail returns a non-empty messageId", async () => {
      const provider = await factory();
      await provider.provisionInbox({
        companyId: "44444444-4444-4444-4444-444444444444",
        agentId: "agent-sender",
      });
      const result = await provider.sendEmail({
        fromAgentId: "agent-sender",
        to: ["external@example.test"],
        subject: "hello",
        body: "hi there",
      });
      expect(typeof result.messageId).toBe("string");
      expect(result.messageId.length).toBeGreaterThan(0);
    });

    it("sendEmail is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      await provider.provisionInbox({
        companyId: "55555555-5555-5555-5555-555555555555",
        agentId: "agent-idem",
      });
      const input = {
        fromAgentId: "agent-idem",
        to: ["someone@example.test"],
        subject: "dedupe",
        body: "only once",
        idempotencyKey: "msg-key-1",
      };
      const first = await provider.sendEmail(input);
      const second = await provider.sendEmail(input);
      expect(second.messageId).toBe(first.messageId);

      const listed = await provider.listMessages("agent-idem");
      expect(listed).toHaveLength(1);
    });

    it("listMessages returns only messages involving the given agent, newest first", async () => {
      const provider = await factory();
      await provider.provisionInbox({
        companyId: "66666666-6666-6666-6666-666666666666",
        agentId: "agent-out",
      });
      await provider.provisionInbox({
        companyId: "77777777-7777-7777-7777-777777777777",
        agentId: "agent-other",
      });

      await provider.sendEmail({
        fromAgentId: "agent-out",
        to: ["someone@example.test"],
        subject: "first",
        body: "first body",
      });

      // Unrelated agent's message should not appear.
      await provider.sendEmail({
        fromAgentId: "agent-other",
        to: ["else@example.test"],
        subject: "unrelated",
        body: "unrelated",
      });

      const messages = await provider.listMessages("agent-out");
      expect(messages).toHaveLength(1);
      expect(messages[0].subject).toBe("first");
    });

    it("listMessages filters by `since` when provided", async () => {
      const provider = await factory();
      await provider.provisionInbox({
        companyId: "88888888-8888-8888-8888-888888888888",
        agentId: "agent-since",
      });
      await provider.sendEmail({
        fromAgentId: "agent-since",
        to: ["x@example.test"],
        subject: "old",
        body: "old",
      });

      const future = new Date(Date.now() + 60 * 60 * 1000);
      const empty = await provider.listMessages("agent-since", { since: future });
      expect(empty).toEqual([]);
    });

    it("registerCustomDomain returns a pending/stub registration with DNS records", async () => {
      const provider = await factory();
      const reg = await provider.registerCustomDomain({
        companyId: "99999999-9999-9999-9999-999999999999",
        domain: "brand.test",
      });

      expect(reg).toMatchObject({
        registrationId: expect.any(String),
        companyId: "99999999-9999-9999-9999-999999999999",
        domain: "brand.test",
        status: expect.stringMatching(/^(pending|verified|failed|stub)$/),
      });
      expect(Array.isArray(reg.dnsRecords)).toBe(true);
      expect(reg.dnsRecords.length).toBeGreaterThan(0);
      for (const record of reg.dnsRecords) {
        expect(record.host.length).toBeGreaterThan(0);
        expect(record.value.length).toBeGreaterThan(0);
      }
    });

    it("sendEmail without an idempotency key creates distinct messages", async () => {
      const provider = await factory();
      await provider.provisionInbox({
        companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        agentId: "agent-dup",
      });
      const a = await provider.sendEmail({
        fromAgentId: "agent-dup",
        to: ["x@example.test"],
        subject: "same",
        body: "same",
      });
      const b = await provider.sendEmail({
        fromAgentId: "agent-dup",
        to: ["x@example.test"],
        subject: "same",
        body: "same",
      });
      expect(a.messageId).not.toBe(b.messageId);
    });
  });
}
