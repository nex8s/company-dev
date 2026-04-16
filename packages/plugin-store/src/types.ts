export type TemplateKind = "business" | "employee";

export type TemplateEmployee = {
  role: string;
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
