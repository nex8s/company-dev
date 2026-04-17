import { z } from "zod";
import { GETTING_STARTED_STEPS } from "../getting-started/steps.js";

/** Path-param shape: every plugin-company route is companyId-scoped. */
export const companyIdParamSchema = z.object({
  companyId: z.string().uuid(),
});

export const stepIdParamSchema = z.object({
  companyId: z.string().uuid(),
  stepId: z.enum(GETTING_STARTED_STEPS as readonly [string, ...string[]]),
});

export const reviewIdParamSchema = z.object({
  companyId: z.string().uuid(),
  reviewId: z.string().uuid(),
});

/** Body for POST /reviews/:reviewId/{approve,reject}. */
export const decideReviewBodySchema = z
  .object({
    decisionNote: z.string().max(2000).nullish(),
  })
  .strict();

export type DecideReviewBody = z.infer<typeof decideReviewBodySchema>;

const trialStateSchema = z.enum(["trial", "active", "expired", "paused"]);

/** Body for PUT /profile (full create-or-replace). `name` required. */
export const upsertCompanyProfileBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).nullish(),
    positioning: z.string().max(5000).nullish(),
    targetAudience: z.string().max(5000).nullish(),
    strategyText: z.string().max(20_000).nullish(),
    incorporated: z.boolean().optional(),
    logoUrl: z.string().url().nullish(),
    trialState: trialStateSchema.optional(),
  })
  .strict();

export type UpsertCompanyProfileBody = z.infer<typeof upsertCompanyProfileBodySchema>;

/** Body for PATCH /profile (partial update — every field optional). */
export const patchCompanyProfileBodySchema = upsertCompanyProfileBodySchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "PATCH body must include at least one field",
  });

export type PatchCompanyProfileBody = z.infer<typeof patchCompanyProfileBodySchema>;
