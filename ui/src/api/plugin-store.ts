import { api } from "./client";

/**
 * Typed client for `@paperclipai/plugin-store` HTTP routes.
 *
 * As of B-04 + B-05, the in-process contract exists (seeds, repository,
 * `installTemplate` transaction) but the routes are not yet mounted in
 * `server/src/app.ts`. The wire shapes below are tracked against
 * `packages/plugin-store/src/{types,install}.ts` so that when the router
 * lands the swap is mechanical.
 *
 * Today `useStoreData` uses the typed mocks below directly (TODO markers
 * inline). When the routes ship, swap the hook to call this client.
 */

export type TemplateKind = "business" | "employee";
export type TemplateDepartment =
  | "engineering"
  | "marketing"
  | "operations"
  | "sales"
  | "support";

export interface TemplateEmployee {
  readonly role: string;
  readonly department: TemplateDepartment;
  readonly model: string;
  readonly schedule: string;
  readonly responsibilities: readonly string[];
}

/** Mirror of `StoreTemplateRecord` (plugin-store/src/types.ts). */
export interface StoreTemplateDto {
  readonly id: string;
  readonly slug: string;
  readonly kind: TemplateKind;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly skills: readonly string[];
  readonly employees: readonly TemplateEmployee[];
  readonly creator: string;
  readonly downloadCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListTemplatesResponse {
  readonly templates: readonly StoreTemplateDto[];
}

export interface InstallTemplateBody {
  readonly slug: string;
  readonly companyName?: string;
  readonly issuePrefix?: string;
}

/** Mirror of `InstallTemplateResult` (plugin-store/src/install.ts). */
export interface InstallTemplateResponse {
  readonly companyId: string;
  readonly companyProfileId: string;
  readonly ceoAgentId: string;
  readonly hiredAgentIds: readonly string[];
  readonly installationId: string;
}

export const pluginStoreApi = {
  listTemplates: (opts: { kind?: TemplateKind; category?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.kind) params.set("kind", opts.kind);
    if (opts.category) params.set("category", opts.category);
    const qs = params.toString();
    return api.get<ListTemplatesResponse>(
      `/plugin-store/templates${qs ? `?${qs}` : ""}`,
    );
  },
  installTemplate: (body: InstallTemplateBody) =>
    api.post<InstallTemplateResponse>(`/plugin-store/install`, body),
};
