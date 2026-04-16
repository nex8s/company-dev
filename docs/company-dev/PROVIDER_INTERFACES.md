# Company.dev — Provider Interfaces

Every "real-world" primitive Naïve exposes (LLC formation, bank account, email inbox, browser session) is abstracted behind a TypeScript interface. Phase 1 ships Mock implementations; Phase 2 swaps in real providers without changing call sites.

Rule: **no business logic may reach for a real-world provider directly.** All access goes through these interfaces, which in turn dispatch to the configured implementation (via `COMPANY_IDENTITY_PROVIDER=mock|stripe-atlas|firstbase` etc).

---

## `IdentityProvider`

Legal entity formation + KYC for a company.

```ts
export interface IdentityProvider {
  createLegalEntity(input: {
    companyId: string;
    name: string;
    state?: string;         // default Delaware LLC
    founderEmail: string;
  }): Promise<{
    entityId: string;
    entityType: 'LLC' | 'C-Corp' | 'Stub';
    jurisdiction: string;
    status: 'pending' | 'active' | 'failed' | 'stub';
    documents: Array<{ kind: string; url: string }>;
    estimatedCostUsd: number;
  }>;

  getLegalEntity(entityId: string): Promise<LegalEntity | null>;
  listForCompany(companyId: string): Promise<LegalEntity[]>;
  dissolveLegalEntity(entityId: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}
```

**Phase 2 real providers:** Stripe Atlas (US LLC/C-Corp, $500 flat), Firstbase.io ($399), Doola, Clerky.

**Mock behaviour:** returns `{ entityId: 'stub-<uuid>', status: 'stub', jurisdiction: 'Delaware', documents: [] }` and logs the intent. No network calls.

---

## `BankProvider`

Bank account + virtual card issuance per agent.

```ts
export interface BankProvider {
  openAccount(input: {
    companyId: string;
    legalEntityId: string;
    accountType: 'operating' | 'savings';
  }): Promise<BankAccount>;

  issueVirtualCard(input: {
    accountId: string;
    ownerAgentId: string;
    spendingLimitUsd: number;
    merchantCategoryFilters?: string[];
  }): Promise<VirtualCard>;

  listCards(accountId: string): Promise<VirtualCard[]>;
  listTransactions(accountId: string, since?: Date): Promise<Transaction[]>;
  freezeCard(cardId: string): Promise<void>;
}
```

**Phase 2 real providers:** Mercury (best US UX), Column (programmatic, more flexible), Stripe Issuing (embedded cards).

**Mock behaviour:** generates deterministic fake PANs (`4242 42** **** NNNN`), stores in-memory, records `freeze`/`issue` intents to ledger.

---

## `EmailProvider`

Inbound + outbound email per agent, optionally per custom domain.

```ts
export interface EmailProvider {
  provisionInbox(input: {
    companyId: string;
    agentId: string;
    domain?: string;        // defaults to company's test-subdomain under usenaive-style namespace
    localPart?: string;     // defaults to agent slug
  }): Promise<AgentInbox>;

  sendEmail(input: {
    fromAgentId: string;
    to: string[];
    subject: string;
    body: string;
    attachments?: Array<{ filename: string; contentBase64: string }>;
  }): Promise<{ messageId: string }>;

  listMessages(agentId: string, opts?: { since?: Date; limit?: number }): Promise<EmailMessage[]>;
  registerCustomDomain(input: { companyId: string; domain: string }): Promise<DomainRegistration>;
}
```

**Phase 2 real providers:** Resend (cleanest DX), Postmark (transactional reliability). Custom domain flow emits DNS CNAME targets the user adds to their registrar.

**Mock behaviour:** stores messages in Postgres (`agent_inboxes`, `email_messages`), `sendEmail` drops to the same table with `to_self_only: true` if recipient is another agent in the same company; otherwise logs + returns a fake message id. `registerCustomDomain` returns static CNAME stubs.

---

## `BrowserProvider`

Per-agent headful browser session for web tasks.

```ts
export interface BrowserProvider {
  startSession(input: {
    agentId: string;
    purpose: string;
    liveView?: boolean;
  }): Promise<BrowserSession>;

  attachTool(sessionId: string, tool: 'playwright' | 'puppeteer' | 'mcp'): Promise<ToolHandle>;
  getLiveViewUrl(sessionId: string): Promise<string | null>;
  stopSession(sessionId: string): Promise<void>;
  getSessionArtifacts(sessionId: string): Promise<SessionArtifact[]>;
}
```

**Phase 2 real providers:** Browserbase (best live-view), Steel (open-source path), Hyperbrowser.

**Mock behaviour:** returns `{ status: 'inactive', liveViewUrl: null, purpose }` — matches the "Browser inactive" empty state in the prototype. `attachTool` returns a no-op handle.

---

## Configuration

```
# .env.example
COMPANY_IDENTITY_PROVIDER=mock      # mock | stripe-atlas | firstbase
COMPANY_BANK_PROVIDER=mock          # mock | mercury | column | stripe-issuing
COMPANY_EMAIL_PROVIDER=mock         # mock | resend | postmark
COMPANY_BROWSER_PROVIDER=mock       # mock | browserbase | steel | hyperbrowser

STRIPE_ATLAS_API_KEY=
MERCURY_API_KEY=
RESEND_API_KEY=
BROWSERBASE_API_KEY=
```

Each real provider has its own secrets; only the Mock requires none.

---

## Contract tests

Every implementation (Mock + any real) must pass `plugin-identity/src/contract.test.ts`, which exercises:
- round-trip of each primitive
- idempotency on retry with the same idempotency-key
- graceful failure when upstream returns 5xx (retry with backoff)
- the exact response shape required by the UI (so swapping providers never breaks the dashboard)
