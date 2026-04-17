import { z } from "zod";

export const companyAppParamSchema = z.object({
  companyId: z.string().uuid(),
  appId: z.string().uuid(),
});

export const filePathQuerySchema = z.object({
  path: z.string().min(1).max(4096),
});

export const envKeyParamSchema = z.object({
  companyId: z.string().uuid(),
  appId: z.string().uuid(),
  key: z.string().regex(/^[A-Z0-9_][A-Z0-9_]{0,127}$/, {
    message: "env var key must match ^[A-Z0-9_][A-Z0-9_]{0,127}$",
  }),
});

/** `envVars` patch body: flat { KEY: "value" } object; values must be strings. */
export const patchEnvBodySchema = z
  .object({
    envVars: z.record(
      z.string().regex(/^[A-Z0-9_][A-Z0-9_]{0,127}$/),
      z.string().max(10_000),
    ),
  })
  .strict();

export type PatchEnvBody = z.infer<typeof patchEnvBodySchema>;
