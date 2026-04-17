import { z } from "zod";

export const companyAgentParamSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
});

export const cardIdParamSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
  cardId: z.string().min(1),
});

export const issueCardBodySchema = z
  .object({
    spendingLimitUsd: z.number().positive().max(1_000_000),
    merchantCategoryFilters: z.array(z.string().min(1)).max(50).optional(),
    idempotencyKey: z.string().min(1).max(200).optional(),
  })
  .strict();

export type IssueCardBody = z.infer<typeof issueCardBodySchema>;

export const companyIdParamSchema = z.object({
  companyId: z.string().uuid(),
});

export const domainIdParamSchema = z.object({
  companyId: z.string().uuid(),
  domainId: z.string().uuid(),
});

// Hostname per RFC 1123 — labels of letters/digits/hyphens, separated by dots,
// each label 1–63 chars, total length ≤ 253. Lowercased before validation in
// the router.
const hostnamePattern =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const createDomainBodySchema = z
  .object({
    domain: z
      .string()
      .min(3)
      .max(253)
      .transform((s) => s.trim().toLowerCase())
      .refine((s) => hostnamePattern.test(s), { message: "must be a valid hostname" }),
  })
  .strict();

export type CreateDomainBody = z.infer<typeof createDomainBodySchema>;
