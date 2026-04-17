CREATE TABLE "app_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel_id" uuid,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"env_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"production_domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_files" ADD CONSTRAINT "app_files_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_files" ADD CONSTRAINT "app_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_files_app_idx" ON "app_files" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_files_company_idx" ON "app_files" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_files_app_path_uq" ON "app_files" USING btree ("app_id","path");--> statement-breakpoint
CREATE INDEX "apps_company_idx" ON "apps" USING btree ("company_id");