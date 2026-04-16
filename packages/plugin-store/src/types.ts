export type TemplateKind = "business" | "employee";

/**
 * Department tag for a seeded employee. Must match A-03's HireableDepartment
 * (@paperclipai/plugin-company) — kept as a local string type to avoid a
 * runtime cycle through plugin-company.
 */
export type TemplateDepartment =
  | "engineering"
  | "marketing"
  | "operations"
  | "sales"
  | "support";

export type TemplateEmployee = {
  role: string;
  department: TemplateDepartment;
  model: string;
  schedule: string;
  responsibilities: string[];
};

export type SeedTemplate = {
  slug: string;
  kind: TemplateKind;
  title: string;
  category: string;
  summary: string;
  skills: string[];
  employees: TemplateEmployee[];
  creator: string;
};

export type StoreTemplateRecord = SeedTemplate & {
  id: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
};
