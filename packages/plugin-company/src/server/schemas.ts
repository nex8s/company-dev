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

// ---------------------------------------------------------------------------
// A-10 Publishing → Store bridge
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: "slug must be lowercase letters/digits/hyphens, starting and ending with an alphanumeric",
  });

const departmentSchema = z.enum([
  "engineering",
  "marketing",
  "operations",
  "sales",
  "support",
] as const);

export const publishAgentParamSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid(),
});

export const publishAgentBodySchema = z
  .object({
    slug: slugSchema,
    category: z.string().min(1).max(60),
    creator: z.string().min(1).max(120),
    summary: z.string().max(5000).optional(),
    title: z.string().max(200).optional(),
    model: z.string().max(120).optional(),
    schedule: z.string().max(60).optional(),
    responsibilities: z.array(z.string().max(300)).max(40).optional(),
    skills: z.array(z.string().max(60)).max(20).optional(),
    department: departmentSchema.optional(),
  })
  .strict();

export type PublishAgentBody = z.infer<typeof publishAgentBodySchema>;

export const publishCompanyBodySchema = z
  .object({
    slug: slugSchema,
    category: z.string().min(1).max(60),
    creator: z.string().min(1).max(120),
    summary: z.string().max(5000).optional(),
    title: z.string().max(200).optional(),
    skills: z.array(z.string().max(60)).max(20).optional(),
    agentOverrides: z
      .record(
        z.string().uuid(),
        z
          .object({
            role: z.string().max(120).optional(),
            department: departmentSchema.optional(),
            model: z.string().max(120).optional(),
            schedule: z.string().max(60).optional(),
            responsibilities: z.array(z.string().max(300)).max(40).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type PublishCompanyBody = z.infer<typeof publishCompanyBodySchema>;

export const listPublishedTemplatesQuerySchema = z
  .object({
    kind: z.enum(["employee", "business"]).optional(),
  })
  .strict();
