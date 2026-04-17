import { describe, it, expect } from "vitest";
import { runBankProviderContract } from "./contract.js";
import { MockBankProvider } from "./mock.js";

runBankProviderContract("MockBankProvider", () => new MockBankProvider());

describe("MockBankProvider · mock-specific behaviour", () => {
  it("generates deterministic `4242 42** **** NNNN` PANs", async () => {
    const mock = new MockBankProvider();
    const account = await mock.openAccount({
      companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      legalEntityId: "stub-1",
      accountType: "operating",
    });

    const first = await mock.issueVirtualCard({
      accountId: account.accountId,
      ownerAgentId: "agent-1",
      spendingLimitUsd: 100,
    });
    const second = await mock.issueVirtualCard({
      accountId: account.accountId,
      ownerAgentId: "agent-2",
      spendingLimitUsd: 200,
    });

    expect(first.pan).toBe("4242 42** **** 0001");
    expect(first.last4).toBe("0001");
    expect(second.pan).toBe("4242 42** **** 0002");
    expect(second.last4).toBe("0002");
  });

  it("produces acct-/card- prefixed ids", async () => {
    const mock = new MockBankProvider();
    const account = await mock.openAccount({
      companyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      legalEntityId: "stub-2",
      accountType: "savings",
    });
    const card = await mock.issueVirtualCard({
      accountId: account.accountId,
      ownerAgentId: "agent-x",
      spendingLimitUsd: 25,
    });
    expect(account.accountId.startsWith("acct-")).toBe(true);
    expect(card.cardId.startsWith("card-")).toBe(true);
  });

  it("logs structured events on every write", async () => {
    const events: MockEvent[] = [];
    const mock = new MockBankProvider({ log: (e) => events.push(e) });

    const account = await mock.openAccount({
      companyId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      legalEntityId: "stub-3",
      accountType: "operating",
    });
    const card = await mock.issueVirtualCard({
      accountId: account.accountId,
      ownerAgentId: "agent-l",
      spendingLimitUsd: 10,
    });
    await mock.freezeCard(card.cardId);

    expect(events.map((e) => e.intent)).toEqual([
      "openAccount",
      "issueVirtualCard",
      "freezeCard",
    ]);
  });

  it("rejects card issuance against an unknown account", async () => {
    const mock = new MockBankProvider();
    await expect(
      mock.issueVirtualCard({
        accountId: "acct-missing",
        ownerAgentId: "agent-z",
        spendingLimitUsd: 1,
      }),
    ).rejects.toThrow(/account not found/i);
  });
});

type MockEvent = { intent: string; at: Date; payload: unknown };
