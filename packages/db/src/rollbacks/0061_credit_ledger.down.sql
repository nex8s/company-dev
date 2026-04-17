-- Rollback for 0061_credit_ledger.sql (A-07: credit_ledger table).
-- Documentation-only per the Company.dev hard rule "every migration has a rollback";
-- not auto-applied by the drizzle migrator.
DROP INDEX IF EXISTS "credit_ledger_company_entry_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "credit_ledger_company_agent_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "credit_ledger_company_created_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE IF EXISTS "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE IF EXISTS "credit_ledger" DROP CONSTRAINT IF EXISTS "credit_ledger_company_id_companies_id_fk";--> statement-breakpoint
DROP TABLE IF EXISTS "credit_ledger";
