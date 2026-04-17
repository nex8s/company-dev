export { apps, appFiles, appDeployments } from "./schema.js";
export type {
  AppRow,
  NewAppRow,
  AppFileRow,
  NewAppFileRow,
  AppDeploymentRow,
  NewAppDeploymentRow,
} from "./schema.js";
export {
  InMemoryAppsRepository,
} from "./apps.js";
export type {
  AppRecord,
  CreateAppInput,
  AppsRepository,
} from "./apps.js";
export * from "./builder/index.js";

import { apps, appFiles, appDeployments } from "./schema.js";

export function registerPlugin(): {
  name: string;
  tables: {
    apps: typeof apps;
    appFiles: typeof appFiles;
    appDeployments: typeof appDeployments;
  };
} {
  return {
    name: "@paperclipai/plugin-apps-builder",
    tables: { apps, appFiles, appDeployments },
  };
}
