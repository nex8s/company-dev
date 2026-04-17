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
