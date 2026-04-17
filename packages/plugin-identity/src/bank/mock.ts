import { randomUUID } from "node:crypto";
import type {
  BankAccount,
  BankProvider,
  IssueVirtualCardInput,
  OpenAccountInput,
  Transaction,
  VirtualCard,
} from "./provider.js";

export type MockBankLogEvent = {
  intent: "openAccount" | "issueVirtualCard" | "freezeCard";
  at: Date;
  payload: unknown;
};

export type MockBankProviderOptions = {
  /** Receives a structured log event for every write. Defaults to a no-op. */
  log?: (event: MockBankLogEvent) => void;
};

/**
 * Mock BankProvider — in-memory, deterministic fake PANs (`4242 42** **** NNNN`).
 * Matches the PROVIDER_INTERFACES.md spec. No network calls.
 */
export class MockBankProvider implements BankProvider {
  private readonly accounts = new Map<string, BankAccount>();
  private readonly cards = new Map<string, VirtualCard>();
  private readonly txsByAccount = new Map<string, Transaction[]>();
  private readonly idempotencyAccounts = new Map<string, string>();
  private readonly idempotencyCards = new Map<string, string>();
  private readonly log: (event: MockBankLogEvent) => void;
  private panCounter = 0;

  constructor(opts: MockBankProviderOptions = {}) {
    this.log = opts.log ?? (() => {});
  }

  async openAccount(input: OpenAccountInput): Promise<BankAccount> {
    if (input.idempotencyKey) {
      const priorId = this.idempotencyAccounts.get(input.idempotencyKey);
      if (priorId) {
        const existing = this.accounts.get(priorId);
        if (existing) return existing;
      }
    }

    const account: BankAccount = {
      accountId: `acct-${randomUUID()}`,
      companyId: input.companyId,
      legalEntityId: input.legalEntityId,
      accountType: input.accountType,
      status: "stub",
      balanceUsd: 0,
      currency: "USD",
      createdAt: new Date(),
    };
    this.accounts.set(account.accountId, account);
    if (input.idempotencyKey) {
      this.idempotencyAccounts.set(input.idempotencyKey, account.accountId);
    }
    this.log({ intent: "openAccount", at: new Date(), payload: input });
    return account;
  }

  async issueVirtualCard(input: IssueVirtualCardInput): Promise<VirtualCard> {
    if (input.idempotencyKey) {
      const priorId = this.idempotencyCards.get(input.idempotencyKey);
      if (priorId) {
        const existing = this.cards.get(priorId);
        if (existing) return existing;
      }
    }

    if (!this.accounts.has(input.accountId)) {
      throw new Error(`account not found: ${input.accountId}`);
    }

    const seq = ++this.panCounter;
    const last4 = String(seq).padStart(4, "0");
    const pan = `4242 42** **** ${last4}`;

    const card: VirtualCard = {
      cardId: `card-${randomUUID()}`,
      accountId: input.accountId,
      ownerAgentId: input.ownerAgentId,
      pan,
      last4,
      spendingLimitUsd: input.spendingLimitUsd,
      spentUsd: 0,
      merchantCategoryFilters: input.merchantCategoryFilters ?? [],
      status: "active",
      createdAt: new Date(),
    };
    this.cards.set(card.cardId, card);
    if (input.idempotencyKey) {
      this.idempotencyCards.set(input.idempotencyKey, card.cardId);
    }
    this.log({ intent: "issueVirtualCard", at: new Date(), payload: input });
    return card;
  }

  async listCards(accountId: string): Promise<VirtualCard[]> {
    return Array.from(this.cards.values()).filter((c) => c.accountId === accountId);
  }

  async listTransactions(accountId: string, since?: Date): Promise<Transaction[]> {
    const all = this.txsByAccount.get(accountId) ?? [];
    if (!since) return [...all];
    return all.filter((t) => t.occurredAt >= since);
  }

  async freezeCard(cardId: string): Promise<void> {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`card not found: ${cardId}`);
    }
    this.cards.set(cardId, { ...card, status: "frozen" });
    this.log({ intent: "freezeCard", at: new Date(), payload: { cardId } });
  }
}
