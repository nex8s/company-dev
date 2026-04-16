export { apps } from "./schema.js";
export type { AppRow, NewAppRow } from "./schema.js";
export {
  InMemoryAppsRepository,
} from "./apps.js";
export type {
  AppRecord,
  CreateAppInput,
  AppsRepository,
} from "./apps.js";

import { apps } from "./schema.js";

export function registerPlugin(): {
  name: string;
  tables: { apps: typeof apps };
} {
  return {
    name: "@paperclipai/plugin-apps-builder",
    tables: { apps },
  };
}
