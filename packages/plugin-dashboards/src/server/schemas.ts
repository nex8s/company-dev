import { z } from "zod";
import { DASHBOARD_WIDGET_TYPES } from "../schema.js";

export const companyIdParamSchema = z.object({ companyId: z.string().uuid() });
export const companyPageParamSchema = z.object({
  companyId: z.string().uuid(),
  pageId: z.string().uuid(),
});

const widgetPositionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

export const widgetSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.enum(DASHBOARD_WIDGET_TYPES as readonly [string, ...string[]]),
    title: z.string().max(200).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    position: widgetPositionSchema.optional(),
  })
  .strict();

export const layoutSchema = z
  .object({
    widgets: z.array(widgetSchema).max(50),
  })
  .strict();

export const createDashboardPageBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    layout: layoutSchema,
  })
  .strict();

export const updateDashboardPageBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    layout: layoutSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "PATCH body must include at least one of `title` or `layout`",
  });

export type CreateDashboardPageBody = z.infer<typeof createDashboardPageBodySchema>;
export type UpdateDashboardPageBody = z.infer<typeof updateDashboardPageBodySchema>;
