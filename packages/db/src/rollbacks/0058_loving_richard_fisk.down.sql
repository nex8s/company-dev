-- Rollback for 0058_loving_richard_fisk.sql (A-04: getting_started table).
-- Documentation-only per the Company.dev hard rule "every migration has a rollback";
-- not auto-applied by the drizzle migrator.
DROP INDEX IF EXISTS "getting_started_company_uq";--> statement-breakpoint
ALTER TABLE IF EXISTS "getting_started" DROP CONSTRAINT IF EXISTS "getting_started_company_id_companies_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "getting_started";
