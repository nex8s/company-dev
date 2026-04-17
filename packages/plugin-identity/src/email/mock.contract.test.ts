import { describe, it, expect } from "vitest";
import { runEmailProviderContract } from "./contract.js";
import { MockEmailProvider } from "./mock.js";

runEmailProviderContract("MockEmailProvider", () => new MockEmailProvider());

describe("MockEmailProvider · mock-specific behaviour", () => {
  it("defaults the sending domain when none is provided", async () => {
    const mock = new MockEmailProvider({ defaultDomain: "agents.company.test" });
    const inbox = await mock.provisionInbox({
      companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      agentId: "slug-alpha",
    });
    expect(inbox.domain).toBe("agents.company.test");
    expect(inbox.localPart).toBe("slug-alpha");
    expect(inbox.address).toBe("slug-alpha@agents.company.test");
  });

  it("sendEmail delivers internally (toSelfOnly:true) when every recipient is another agent in the same company", async () => {
    const mock = new MockEmailProvider();
    const sender = await mock.provisionInbox({
      companyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      agentId: "sender",
    });
    const receiver = await mock.provisionInbox({
      companyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      agentId: "receiver",
    });

    await mock.sendEmail({
      fromAgentId: sender.agentId,
      to: [receiver.address],
      subject: "internal",
      body: "hey",
    });

    const inbox = await mock.listMessages(receiver.agentId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].direction).toBe("internal");
    expect(inbox[0].toSelfOnly).toBe(true);
    expect(inbox[0].toAgentIds).toEqual([receiver.agentId]);
  });

  it("sendEmail flagged outbound/external when at least one recipient is outside the company", async () => {
    const mock = new MockEmailProvider();
    await mock.provisionInbox({
      companyId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      agentId: "external-sender",
    });
    await mock.sendEmail({
      fromAgentId: "external-sender",
      to: ["somebody@outside.test"],
      subject: "external",
      body: "to the world",
    });
    const messages = await mock.listMessages("external-sender");
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe("outbound");
    expect(messages[0].toSelfOnly).toBe(false);
  });

  it("rejects sendEmail from an agent without a provisioned inbox", async () => {
    const mock = new MockEmailProvider();
    await expect(
      mock.sendEmail({
        fromAgentId: "ghost-agent",
        to: ["x@example.test"],
        subject: "ghost",
        body: "ghost",
      }),
    ).rejects.toThrow(/no inbox provisioned/i);
  });

  it("registerCustomDomain returns static CNAME + TXT stubs", async () => {
    const mock = new MockEmailProvider();
    const reg = await mock.registerCustomDomain({
      companyId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      domain: "brand.test",
    });
    const kinds = reg.dnsRecords.map((r) => r.type).sort();
    expect(kinds).toEqual(["CNAME", "TXT"]);
    expect(reg.status).toBe("stub");
  });

  it("logs a structured event on every write", async () => {
    const events: { intent: string }[] = [];
    const mock = new MockEmailProvider({ log: (e) => events.push(e) });
    await mock.provisionInbox({
      companyId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      agentId: "agent-log",
    });
    await mock.sendEmail({
      fromAgentId: "agent-log",
      to: ["x@example.test"],
      subject: "log",
      body: "log",
    });
    await mock.registerCustomDomain({
      companyId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      domain: "log.test",
    });
    expect(events.map((e) => e.intent)).toEqual([
      "provisionInbox",
      "sendEmail",
      "registerCustomDomain",
    ]);
  });
});
