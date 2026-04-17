import { describe, it, expect } from "vitest";
import type { IdentityProvider } from "./provider.js";

export type IdentityProviderFactory = () => IdentityProvider | Promise<IdentityProvider>;

/**
 * Shared contract every IdentityProvider implementation must satisfy.
 * Apply from each impl's *.contract.test.ts via `runIdentityProviderContract(...)`.
 *
 * Covers PROVIDER_INTERFACES.md's four requirements:
 *   - round-trip of each primitive
 *   - idempotency on retry with the same idempotency key
 *   - exact response shape required by the UI
 *   - graceful failure when the upstream cannot satisfy the request
 */
export function runIdentityProviderContract(
  label: string,
  factory: IdentityProviderFactory,
): void {
  describe(`IdentityProvider contract · ${label}`, () => {
    it("createLegalEntity returns the UI response shape", async () => {
      const provider = await factory();
      const result = await provider.createLegalEntity({
        companyId: "11111111-1111-1111-1111-111111111111",
        name: "Acme LLC",
        founderEmail: "founder@acme.test",
      });

      expect(result).toMatchObject({
        entityId: expect.any(String),
        entityType: expect.stringMatching(/^(LLC|C-Corp|Stub)$/),
        jurisdiction: expect.any(String),
        status: expect.stringMatching(/^(pending|active|failed|stub)$/),
        documents: expect.any(Array),
        estimatedCostUsd: expect.any(Number),
      });
      expect(result.entityId.length).toBeGreaterThan(0);
    });

    it("getLegalEntity round-trips a freshly created entity", async () => {
      const provider = await factory();
      const created = await provider.createLegalEntity({
        companyId: "22222222-2222-2222-2222-222222222222",
        name: "Round-trip Co",
        founderEmail: "founder@roundtrip.test",
      });

      const fetched = await provider.getLegalEntity(created.entityId);
      expect(fetched).not.toBeNull();
      expect(fetched?.entityId).toBe(created.entityId);
      expect(fetched?.name).toBe("Round-trip Co");
      expect(fetched?.founderEmail).toBe("founder@roundtrip.test");
    });

    it("listForCompany returns only that company's entities", async () => {
      const provider = await factory();
      const a = await provider.createLegalEntity({
        companyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "Alpha",
        founderEmail: "a@a.test",
      });
      await provider.createLegalEntity({
        companyId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        name: "Beta",
        founderEmail: "b@b.test",
      });

      const aList = await provider.listForCompany("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
      expect(aList).toHaveLength(1);
      expect(aList[0].entityId).toBe(a.entityId);

      const empty = await provider.listForCompany("cccccccc-cccc-cccc-cccc-cccccccccccc");
      expect(empty).toEqual([]);
    });

    it("createLegalEntity is idempotent on retry with the same idempotency key", async () => {
      const provider = await factory();
      const input = {
        companyId: "33333333-3333-3333-3333-333333333333",
        name: "Idempotent LLC",
        founderEmail: "founder@idempotent.test",
        idempotencyKey: "key-abc-123",
      };

      const first = await provider.createLegalEntity(input);
      const second = await provider.createLegalEntity(input);

      expect(second.entityId).toBe(first.entityId);
      const listed = await provider.listForCompany(input.companyId);
      expect(listed).toHaveLength(1);
    });

    it("createLegalEntity without an idempotency key does NOT dedupe across calls", async () => {
      const provider = await factory();
      const input = {
        companyId: "44444444-4444-4444-4444-444444444444",
        name: "Dup LLC",
        founderEmail: "founder@dup.test",
      };

      const first = await provider.createLegalEntity(input);
      const second = await provider.createLegalEntity(input);

      expect(second.entityId).not.toBe(first.entityId);
      const listed = await provider.listForCompany(input.companyId);
      expect(listed).toHaveLength(2);
    });

    it("createLegalEntity honours a state override as the jurisdiction", async () => {
      const provider = await factory();
      const result = await provider.createLegalEntity({
        companyId: "55555555-5555-5555-5555-555555555555",
        name: "Texas Co",
        state: "Texas",
        founderEmail: "tx@tx.test",
      });
      expect(result.jurisdiction).toBe("Texas");
    });

    it("dissolveLegalEntity removes an existing entity and returns { ok: true }", async () => {
      const provider = await factory();
      const created = await provider.createLegalEntity({
        companyId: "66666666-6666-6666-6666-666666666666",
        name: "Doomed LLC",
        founderEmail: "d@d.test",
      });

      const result = await provider.dissolveLegalEntity(created.entityId);
      expect(result).toEqual({ ok: true });

      const after = await provider.getLegalEntity(created.entityId);
      expect(after).toBeNull();
    });

    it("dissolveLegalEntity returns { ok: false, reason } for an unknown entity", async () => {
      const provider = await factory();
      const result = await provider.dissolveLegalEntity("stub-missing");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });
  });
}
