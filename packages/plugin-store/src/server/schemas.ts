import { z } from "zod";

export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, { message: "slug must match ^[a-z0-9-]+$" }),
});

export const listTemplatesQuerySchema = z
  .object({
    kind: z.enum(["business", "employee"]).optional(),
    category: z.string().min(1).max(100).optional(),
    q: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
