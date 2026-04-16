import { companyProfiles } from "@paperclipai/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export { companyProfiles };

export type CompanyProfile = InferSelectModel<typeof companyProfiles>;
export type NewCompanyProfile = InferInsertModel<typeof companyProfiles>;

export type TrialState = "trial" | "active" | "expired" | "paused";
