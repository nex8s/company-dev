export { apps, appFiles } from "./schema.js";
export type { AppRow, NewAppRow, AppFileRow, NewAppFileRow } from "./schema.js";
export {
  InMemoryAppsRepository,
} from "./apps.js";
export type {
  AppRecord,
  CreateAppInput,
  AppsRepository,
} from "./apps.js";
export * from "./builder/index.js";

import { apps, appFiles } from "./schema.js";

export function registerPlugin(): {
  name: string;
  tables: { apps: typeof apps; appFiles: typeof appFiles };
} {
  return {
    name: "@paperclipai/plugin-apps-builder",
    tables: { apps, appFiles },
  };
}
