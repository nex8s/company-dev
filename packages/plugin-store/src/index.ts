export {
  storeTemplates,
  templateInstallations,
} from "./schema.js";
export type {
  StoreTemplateRow,
  NewStoreTemplateRow,
  TemplateInstallationRow,
  NewTemplateInstallationRow,
} from "./schema.js";
export type {
  TemplateKind,
  TemplateDepartment,
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
export {
  installTemplate,
  getInstalledSkills,
  getInstallationForCompany,
  countAgentsForCompany,
} from "./install.js";
export type {
  InstallTemplateInput,
  InstallTemplateResult,
} from "./install.js";

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
