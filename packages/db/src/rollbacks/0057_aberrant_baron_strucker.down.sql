-- Rollback for 0057_aberrant_baron_strucker.sql (A-02: company_profiles table).
-- Not auto-applied by the drizzle migrator — documentation-only per the
-- Company.dev hard rule "every migration has a rollback". Executed manually
-- via `psql -f` when rolling back the A-02 change.
DROP INDEX IF EXISTS "company_profiles_trial_state_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "company_profiles_company_uq";--> statement-breakpoint
ALTER TABLE IF EXISTS "company_profiles" DROP CONSTRAINT IF EXISTS "company_profiles_company_id_companies_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "company_profiles";
