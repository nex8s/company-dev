import { apps, appFiles, appDeployments } from "@paperclipai/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Drizzle bindings for B-01 `apps`, B-02 `app_files`, and B-03
 * `app_deployments`. The tables themselves live in `packages/db` so
 * drizzle-kit's generator can pick them up; this file just re-exports
 * them so plugin-apps-builder consumers keep importing from
 * `@paperclipai/plugin-apps-builder/schema`.
 */
export { apps, appFiles, appDeployments };
export type AppRow = InferSelectModel<typeof apps>;
export type NewAppRow = InferInsertModel<typeof apps>;
export type AppFileRow = InferSelectModel<typeof appFiles>;
export type NewAppFileRow = InferInsertModel<typeof appFiles>;
export type AppDeploymentRow = InferSelectModel<typeof appDeployments>;
export type NewAppDeploymentRow = InferInsertModel<typeof appDeployments>;
