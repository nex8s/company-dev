export type EmailAttachment = {
  filename: string;
  contentBase64: string;
};

export type ProvisionInboxInput = {
  companyId: string;
  agentId: string;
  domain?: string;
  localPart?: string;
  idempotencyKey?: string;
};

export type AgentInbox = {
  inboxId: string;
  companyId: string;
  agentId: string;
  address: string;
  domain: string;
  localPart: string;
  createdAt: Date;
};

export type SendEmailInput = {
  fromAgentId: string;
  to: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
};

export type EmailDirection = "inbound" | "outbound" | "internal";

export type EmailMessage = {
  messageId: string;
  companyId: string;
  fromAgentId: string | null;
  fromAddress: string;
  toAgentIds: string[];
  toAddresses: string[];
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  direction: EmailDirection;
  toSelfOnly: boolean;
  occurredAt: Date;
};

export type ListMessagesOptions = {
  since?: Date;
  limit?: number;
};

export type DomainRegistrationStatus = "pending" | "verified" | "failed" | "stub";

export type DomainDnsRecord = {
  type: "CNAME" | "TXT" | "MX";
  host: string;
  value: string;
};

export type RegisterCustomDomainInput = {
  companyId: string;
  domain: string;
  idempotencyKey?: string;
};

export type DomainRegistration = {
  registrationId: string;
  companyId: string;
  domain: string;
  status: DomainRegistrationStatus;
  dnsRecords: DomainDnsRecord[];
  createdAt: Date;
};

export interface EmailProvider {
  provisionInbox(input: ProvisionInboxInput): Promise<AgentInbox>;
  sendEmail(input: SendEmailInput): Promise<{ messageId: string }>;
  listMessages(agentId: string, opts?: ListMessagesOptions): Promise<EmailMessage[]>;
  registerCustomDomain(input: RegisterCustomDomainInput): Promise<DomainRegistration>;
}
