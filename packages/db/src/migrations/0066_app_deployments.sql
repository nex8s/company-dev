CREATE TABLE "app_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"triggered_by_agent_id" uuid,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app_deployments" ADD CONSTRAINT "app_deployments_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_deployments" ADD CONSTRAINT "app_deployments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_deployments" ADD CONSTRAINT "app_deployments_triggered_by_agent_id_agents_id_fk" FOREIGN KEY ("triggered_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_deployments_app_idx" ON "app_deployments" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_deployments_company_idx" ON "app_deployments" USING btree ("company_id");
