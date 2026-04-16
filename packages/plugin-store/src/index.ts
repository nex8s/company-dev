export { storeTemplates } from "./schema.js";
export type { StoreTemplateRow, NewStoreTemplateRow } from "./schema.js";
export type {
  TemplateKind,
  TemplateEmployee,
  SeedTemplate,
  StoreTemplateRecord,
} from "./types.js";
export {
  InMemoryStoreTemplatesRepository,
  listTemplates,
} from "./repo.js";
export type {
  StoreTemplatesRepository,
  ListTemplatesOptions,
} from "./repo.js";
export { seedTemplates } from "./seeds/index.js";

import { storeTemplates } from "./schema.js";

export function registerPlugin(): {
  name: string;
  tables: { storeTemplates: typeof storeTemplates };
} {
  return {
    name: "@paperclipai/plugin-store",
    tables: { storeTemplates },
  };
}
