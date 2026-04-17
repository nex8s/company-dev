import { z } from "zod";
import { SUBSCRIPTION_PLANS, TOP_UP_OPTIONS } from "../billing/catalog.js";

export const companyIdParamSchema = z.object({
  companyId: z.string().uuid(),
});

const subscriptionPlanSchema = z.enum(
  Object.keys(SUBSCRIPTION_PLANS) as [string, ...string[]],
);

export const createSubscriptionCheckoutBodySchema = z
  .object({
    plan: subscriptionPlanSchema,
    customerEmail: z.string().email().optional(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  })
  .strict();

export type CreateSubscriptionCheckoutBody = z.infer<
  typeof createSubscriptionCheckoutBodySchema
>;

const topUpCreditsSchema = z
  .number()
  .int()
  .refine((n) => TOP_UP_OPTIONS.some((o) => o.credits === n), {
    message: "credits must be one of 20, 50, 100, 250",
  });

export const createTopUpCheckoutBodySchema = z
  .object({
    credits: topUpCreditsSchema,
    customerEmail: z.string().email().optional(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
  })
  .strict();

export type CreateTopUpCheckoutBody = z.infer<typeof createTopUpCheckoutBodySchema>;

export const createPortalBodySchema = z
  .object({
    returnUrl: z.string().url(),
  })
  .strict();

export type CreatePortalBody = z.infer<typeof createPortalBodySchema>;
