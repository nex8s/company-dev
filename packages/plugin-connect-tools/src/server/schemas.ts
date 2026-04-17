import { z } from "zod";
import { SUPPORTED_TOOL_KINDS } from "../adapters/registry.js";

export const companyIdParamSchema = z.object({
  companyId: z.string().uuid(),
});

export const connectionIdParamSchema = z.object({
  companyId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

const toolKindSchema = z.enum(SUPPORTED_TOOL_KINDS as readonly [string, ...string[]]);

export const createConnectionBodySchema = z
  .object({
    toolKind: toolKindSchema,
    label: z.string().min(1).max(200),
    token: z.string().min(1).max(8000),
    refreshToken: z.string().min(1).max(8000).nullish(),
    scopes: z.array(z.string().min(1)).max(50).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export type CreateConnectionBody = z.infer<typeof createConnectionBodySchema>;
