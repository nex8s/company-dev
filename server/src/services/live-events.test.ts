import { describe, expect, it } from "vitest";
import {
  publishLiveEvent,
  subscribeAllCompaniesLiveEvents,
  subscribeCompanyLiveEvents,
} from "./live-events.js";
import { randomUUID } from "node:crypto";

describe("subscribeAllCompaniesLiveEvents (A-06.6)", () => {
  it("delivers events from every company without per-company subscription", () => {
    const companyA = randomUUID();
    const companyB = randomUUID();
    const received: Array<{ companyId: string; type: string }> = [];

    const unsubscribe = subscribeAllCompaniesLiveEvents((event) => {
      received.push({ companyId: event.companyId, type: event.type });
    });

    publishLiveEvent({ companyId: companyA, type: "heartbeat.run.event", payload: { x: 1 } });
    publishLiveEvent({ companyId: companyB, type: "heartbeat.run.queued", payload: { x: 2 } });

    expect(received).toEqual([
      { companyId: companyA, type: "heartbeat.run.event" },
      { companyId: companyB, type: "heartbeat.run.queued" },
    ]);

    unsubscribe();
  });

  it("returns an unsubscribe handle that stops further delivery", () => {
    const companyId = randomUUID();
    const received: number[] = [];
    const unsubscribe = subscribeAllCompaniesLiveEvents((event) => {
      received.push(event.id);
    });

    publishLiveEvent({ companyId, type: "agent.status" });
    unsubscribe();
    publishLiveEvent({ companyId, type: "agent.status" });

    expect(received).toHaveLength(1);
  });

  it("isolates a throwing listener from other subscribers", () => {
    const companyId = randomUUID();
    const goodReceived: number[] = [];
    const unsubscribeBad = subscribeAllCompaniesLiveEvents(() => {
      throw new Error("boom");
    });
    const unsubscribeGood = subscribeAllCompaniesLiveEvents((event) => {
      goodReceived.push(event.id);
    });

    expect(() =>
      publishLiveEvent({ companyId, type: "activity.logged" }),
    ).not.toThrow();
    expect(goodReceived).toHaveLength(1);

    unsubscribeBad();
    unsubscribeGood();
  });

  it("does not interfere with the per-company subscribe path", () => {
    const companyId = randomUUID();
    const allReceived: number[] = [];
    const perCompanyReceived: number[] = [];

    const unsubAll = subscribeAllCompaniesLiveEvents((event) => {
      allReceived.push(event.id);
    });
    const unsubOne = subscribeCompanyLiveEvents(companyId, (event) => {
      perCompanyReceived.push(event.id);
    });

    publishLiveEvent({ companyId, type: "heartbeat.run.event" });

    expect(allReceived).toHaveLength(1);
    expect(perCompanyReceived).toHaveLength(1);
    expect(allReceived[0]).toBe(perCompanyReceived[0]);

    unsubAll();
    unsubOne();
  });

  it("ignores duplicate subscriptions of the same listener (Set semantics)", () => {
    const companyId = randomUUID();
    const received: number[] = [];
    const handler = (event: { id: number }) => {
      received.push(event.id);
    };

    const unsub1 = subscribeAllCompaniesLiveEvents(handler);
    const unsub2 = subscribeAllCompaniesLiveEvents(handler);

    publishLiveEvent({ companyId, type: "agent.status" });

    expect(received).toHaveLength(1);

    unsub1();
    unsub2();
  });
});
