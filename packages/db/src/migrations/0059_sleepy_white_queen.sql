CREATE TABLE "pending_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"submitted_by_agent_id" uuid,
	"submission_note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_agent_id" uuid,
	"decided_by_user_id" text,
	"decision_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_submitted_by_agent_id_agents_id_fk" FOREIGN KEY ("submitted_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_reviews" ADD CONSTRAINT "pending_reviews_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_reviews_company_status_idx" ON "pending_reviews" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "pending_reviews_issue_idx" ON "pending_reviews" USING btree ("issue_id");