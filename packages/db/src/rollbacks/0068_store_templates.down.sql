-- Rollback for 0068_store_templates.sql (A-10: store_templates table).
-- Documentation-only per the Company.dev hard rule "every migration has a rollback";
-- not auto-applied by the drizzle migrator.
DROP INDEX IF EXISTS "store_templates_slug_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "store_templates";
