CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"positioning" text,
	"target_audience" text,
	"strategy_text" text,
	"incorporated" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"trial_state" text DEFAULT 'trial' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_company_uq" ON "company_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_profiles_trial_state_idx" ON "company_profiles" USING btree ("trial_state");