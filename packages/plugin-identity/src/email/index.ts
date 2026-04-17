export type {
  EmailProvider,
  EmailAttachment,
  EmailDirection,
  EmailMessage,
  AgentInbox,
  ProvisionInboxInput,
  SendEmailInput,
  ListMessagesOptions,
  DomainDnsRecord,
  DomainRegistration,
  DomainRegistrationStatus,
  RegisterCustomDomainInput,
} from "./provider.js";
export { MockEmailProvider } from "./mock.js";
export type { MockEmailLogEvent, MockEmailProviderOptions } from "./mock.js";
export { runEmailProviderContract } from "./contract.js";
export type { EmailProviderFactory } from "./contract.js";
