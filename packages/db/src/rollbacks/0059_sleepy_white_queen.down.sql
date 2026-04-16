-- Rollback for 0059_sleepy_white_queen.sql (A-05: pending_reviews table).
-- Documentation-only per the Company.dev hard rule "every migration has a rollback";
-- not auto-applied by the drizzle migrator.
DROP INDEX IF EXISTS "pending_reviews_issue_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "pending_reviews_company_status_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "pending_reviews" DROP CONSTRAINT IF EXISTS "pending_reviews_decided_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE IF EXISTS "pending_reviews" DROP CONSTRAINT IF EXISTS "pending_reviews_submitted_by_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE IF EXISTS "pending_reviews" DROP CONSTRAINT IF EXISTS "pending_reviews_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE IF EXISTS "pending_reviews" DROP CONSTRAINT IF EXISTS "pending_reviews_company_id_companies_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "pending_reviews";
