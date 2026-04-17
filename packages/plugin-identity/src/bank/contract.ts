import { describe, it, expect } from "vitest";
import type { BankProvider } from "./provider.js";

export type BankProviderFactory = () => BankProvider | Promise<BankProvider>;

/**
 * Shared contract every BankProvider implementation must satisfy.
 * Apply from each impl's *.contract.test.ts via `runBankProviderContract(...)`.
 */
export function runBankProviderContract(
  label: string,
  factory: BankProviderFactory,
): void {
  describe(`BankProvider contract · ${label}`, () => {
    it("openAccount returns the UI response shape", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "11111111-1111-1111-1111-111111111111",
        legalEntityId: "stub-entity-1",
        accountType: "operating",
      });

      expect(account).toMatchObject({
        accountId: expect.any(String),
        companyId: "11111111-1111-1111-1111-111111111111",
        legalEntityId: "stub-entity-1",
        accountType: "operating",
        status: expect.stringMatching(/^(pending|active|frozen|closed|stub)$/),
        balanceUsd: expect.any(Number),
        currency: "USD",
      });
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.accountId.length).toBeGreaterThan(0);
    });

    it("openAccount is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      const input = {
        companyId: "22222222-2222-2222-2222-222222222222",
        legalEntityId: "stub-entity-2",
        accountType: "operating" as const,
        idempotencyKey: "acct-key-1",
      };

      const first = await provider.openAccount(input);
      const second = await provider.openAccount(input);
      expect(second.accountId).toBe(first.accountId);
    });

    it("issueVirtualCard returns a masked PAN and the UI response shape", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "33333333-3333-3333-3333-333333333333",
        legalEntityId: "stub-entity-3",
        accountType: "operating",
      });

      const card = await provider.issueVirtualCard({
        accountId: account.accountId,
        ownerAgentId: "agent-alpha",
        spendingLimitUsd: 500,
      });

      expect(card).toMatchObject({
        cardId: expect.any(String),
        accountId: account.accountId,
        ownerAgentId: "agent-alpha",
        pan: expect.any(String),
        last4: expect.stringMatching(/^\d{4}$/),
        spendingLimitUsd: 500,
        spentUsd: 0,
        merchantCategoryFilters: [],
        status: expect.stringMatching(/^(active|frozen|closed)$/),
      });
      expect(card.pan.includes("*")).toBe(true);
    });

    it("issueVirtualCard is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "44444444-4444-4444-4444-444444444444",
        legalEntityId: "stub-entity-4",
        accountType: "operating",
      });

      const input = {
        accountId: account.accountId,
        ownerAgentId: "agent-beta",
        spendingLimitUsd: 100,
        idempotencyKey: "card-key-1",
      };

      const first = await provider.issueVirtualCard(input);
      const second = await provider.issueVirtualCard(input);
      expect(second.cardId).toBe(first.cardId);

      const cards = await provider.listCards(account.accountId);
      expect(cards).toHaveLength(1);
    });

    it("listCards returns only cards belonging to that account", async () => {
      const provider = await factory();
      const [a, b] = await Promise.all([
        provider.openAccount({
          companyId: "55555555-5555-5555-5555-555555555555",
          legalEntityId: "stub-entity-5a",
          accountType: "operating",
        }),
        provider.openAccount({
          companyId: "66666666-6666-6666-6666-666666666666",
          legalEntityId: "stub-entity-5b",
          accountType: "operating",
        }),
      ]);

      await provider.issueVirtualCard({
        accountId: a.accountId,
        ownerAgentId: "agent-a",
        spendingLimitUsd: 100,
      });
      await provider.issueVirtualCard({
        accountId: b.accountId,
        ownerAgentId: "agent-b",
        spendingLimitUsd: 200,
      });

      const aCards = await provider.listCards(a.accountId);
      expect(aCards).toHaveLength(1);
      expect(aCards[0].ownerAgentId).toBe("agent-a");
    });

    it("listTransactions returns [] for an account with no activity", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "77777777-7777-7777-7777-777777777777",
        legalEntityId: "stub-entity-7",
        accountType: "operating",
      });

      const txs = await provider.listTransactions(account.accountId);
      expect(txs).toEqual([]);
    });

    it("listTransactions filters by `since` when provided", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "88888888-8888-8888-8888-888888888888",
        legalEntityId: "stub-entity-8",
        accountType: "operating",
      });

      const future = new Date(Date.now() + 60 * 60 * 1000);
      const txs = await provider.listTransactions(account.accountId, future);
      expect(txs).toEqual([]);
    });

    it("freezeCard flips an active card's status to frozen", async () => {
      const provider = await factory();
      const account = await provider.openAccount({
        companyId: "99999999-9999-9999-9999-999999999999",
        legalEntityId: "stub-entity-9",
        accountType: "operating",
      });
      const card = await provider.issueVirtualCard({
        accountId: account.accountId,
        ownerAgentId: "agent-freeze",
        spendingLimitUsd: 50,
      });

      await provider.freezeCard(card.cardId);
      const [after] = await provider.listCards(account.accountId);
      expect(after.status).toBe("frozen");
    });

    it("freezeCard on an unknown card rejects with a descriptive error", async () => {
      const provider = await factory();
      await expect(provider.freezeCard("card-does-not-exist")).rejects.toThrow(
        /not found/i,
      );
    });
  });
}
