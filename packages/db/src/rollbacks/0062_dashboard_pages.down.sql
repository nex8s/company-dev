-- Rollback for 0062_dashboard_pages.sql (A-08: dashboard_pages table).
-- Documentation-only per the Company.dev hard rule "every migration has a rollback";
-- not auto-applied by the drizzle migrator.
DROP INDEX IF EXISTS "dashboard_pages_company_created_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "dashboard_pages" DROP CONSTRAINT IF EXISTS "dashboard_pages_company_id_companies_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "dashboard_pages";
