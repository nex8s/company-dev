import { apps, appFiles } from "@paperclipai/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Drizzle bindings for B-01 `apps` and B-02 `app_files`. The tables
 * themselves live in `packages/db` so drizzle-kit's generator can pick
 * them up (see packages/db/src/schema/apps.ts, /app_files.ts); this file
 * just re-exports them so plugin-apps-builder consumers keep importing
 * from `@paperclipai/plugin-apps-builder/schema`.
 */
export { apps, appFiles };
export type AppRow = InferSelectModel<typeof apps>;
export type NewAppRow = InferInsertModel<typeof apps>;
export type AppFileRow = InferSelectModel<typeof appFiles>;
export type NewAppFileRow = InferInsertModel<typeof appFiles>;
