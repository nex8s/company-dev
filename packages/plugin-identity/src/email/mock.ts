import { randomUUID } from "node:crypto";
import type {
  AgentInbox,
  DomainRegistration,
  EmailMessage,
  EmailProvider,
  ListMessagesOptions,
  ProvisionInboxInput,
  RegisterCustomDomainInput,
  SendEmailInput,
} from "./provider.js";

export type MockEmailLogEvent = {
  intent: "provisionInbox" | "sendEmail" | "registerCustomDomain";
  at: Date;
  payload: unknown;
};

export type MockEmailProviderOptions = {
  /** Receives a structured log event for every write. Defaults to a no-op. */
  log?: (event: MockEmailLogEvent) => void;
  /**
   * Default sending domain when `provisionInbox` is called without an explicit
   * `domain`. Mirrors the "test-subdomain under usenaive-style namespace"
   * behaviour described in PROVIDER_INTERFACES.md.
   */
  defaultDomain?: string;
};

/**
 * Mock EmailProvider — in-memory store. Internal-recipient delivery sets
 * `toSelfOnly: true` and attaches to the recipient's inbox. External
 * recipients just record a fake messageId. `registerCustomDomain` returns
 * static CNAME stubs matching the Resend/Postmark DX.
 */
export class MockEmailProvider implements EmailProvider {
  private readonly inboxes = new Map<string, AgentInbox>();
  private readonly inboxByAgent = new Map<string, AgentInbox>();
  private readonly messages: EmailMessage[] = [];
  private readonly idempotencyInboxes = new Map<string, string>();
  private readonly idempotencyMessages = new Map<string, string>();
  private readonly idempotencyDomains = new Map<string, string>();
  private readonly domainRegistrations = new Map<string, DomainRegistration>();
  private readonly log: (event: MockEmailLogEvent) => void;
  private readonly defaultDomain: string;

  constructor(opts: MockEmailProviderOptions = {}) {
    this.log = opts.log ?? (() => {});
    this.defaultDomain = opts.defaultDomain ?? "mock.company.test";
  }

  async provisionInbox(input: ProvisionInboxInput): Promise<AgentInbox> {
    if (input.idempotencyKey) {
      const priorId = this.idempotencyInboxes.get(input.idempotencyKey);
      if (priorId) {
        const existing = this.inboxes.get(priorId);
        if (existing) return existing;
      }
    }

    const domain = input.domain ?? this.defaultDomain;
    const localPart = input.localPart ?? input.agentId;
    const inbox: AgentInbox = {
      inboxId: `inbox-${randomUUID()}`,
      companyId: input.companyId,
      agentId: input.agentId,
      address: `${localPart}@${domain}`,
      domain,
      localPart,
      createdAt: new Date(),
    };
    this.inboxes.set(inbox.inboxId, inbox);
    this.inboxByAgent.set(input.agentId, inbox);
    if (input.idempotencyKey) {
      this.idempotencyInboxes.set(input.idempotencyKey, inbox.inboxId);
    }
    this.log({ intent: "provisionInbox", at: new Date(), payload: input });
    return inbox;
  }

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
    if (input.idempotencyKey) {
      const prior = this.idempotencyMessages.get(input.idempotencyKey);
      if (prior) return { messageId: prior };
    }

    const senderInbox = this.inboxByAgent.get(input.fromAgentId);
    if (!senderInbox) {
      throw new Error(`no inbox provisioned for agent: ${input.fromAgentId}`);
    }

    const toAgentIds: string[] = [];
    for (const address of input.to) {
      const matchingInbox = this.findInboxByAddress(address, senderInbox.companyId);
      if (matchingInbox) toAgentIds.push(matchingInbox.agentId);
    }

    const internal =
      toAgentIds.length > 0 && toAgentIds.length === input.to.length;
    const toSelfOnly = internal;
    const direction: EmailMessage["direction"] = internal ? "internal" : "outbound";

    const message: EmailMessage = {
      messageId: `msg-${randomUUID()}`,
      companyId: senderInbox.companyId,
      fromAgentId: input.fromAgentId,
      fromAddress: senderInbox.address,
      toAgentIds,
      toAddresses: input.to,
      subject: input.subject,
      body: input.body,
      attachments: input.attachments ?? [],
      direction,
      toSelfOnly,
      occurredAt: new Date(),
    };
    this.messages.push(message);
    if (input.idempotencyKey) {
      this.idempotencyMessages.set(input.idempotencyKey, message.messageId);
    }
    this.log({ intent: "sendEmail", at: new Date(), payload: input });
    return { messageId: message.messageId };
  }

  async listMessages(
    agentId: string,
    opts: ListMessagesOptions = {},
  ): Promise<EmailMessage[]> {
    let filtered = this.messages.filter(
      (m) => m.fromAgentId === agentId || m.toAgentIds.includes(agentId),
    );
    if (opts.since) {
      filtered = filtered.filter((m) => m.occurredAt >= opts.since!);
    }
    filtered = filtered
      .slice()
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    if (opts.limit !== undefined) {
      filtered = filtered.slice(0, opts.limit);
    }
    return filtered;
  }

  async registerCustomDomain(
    input: RegisterCustomDomainInput,
  ): Promise<DomainRegistration> {
    if (input.idempotencyKey) {
      const priorId = this.idempotencyDomains.get(input.idempotencyKey);
      if (priorId) {
        const existing = this.domainRegistrations.get(priorId);
        if (existing) return existing;
      }
    }

    const reg: DomainRegistration = {
      registrationId: `domain-${randomUUID()}`,
      companyId: input.companyId,
      domain: input.domain,
      status: "stub",
      dnsRecords: [
        { type: "CNAME", host: `mail.${input.domain}`, value: "mock.mailhost.test" },
        { type: "TXT", host: `_verify.${input.domain}`, value: `mock-verify=${input.companyId}` },
      ],
      createdAt: new Date(),
    };
    this.domainRegistrations.set(reg.registrationId, reg);
    if (input.idempotencyKey) {
      this.idempotencyDomains.set(input.idempotencyKey, reg.registrationId);
    }
    this.log({ intent: "registerCustomDomain", at: new Date(), payload: input });
    return reg;
  }

  private findInboxByAddress(address: string, companyId: string): AgentInbox | undefined {
    for (const inbox of this.inboxes.values()) {
      if (inbox.companyId === companyId && inbox.address === address) return inbox;
    }
    return undefined;
  }
}
