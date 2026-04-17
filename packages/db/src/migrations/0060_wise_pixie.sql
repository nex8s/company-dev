CREATE TABLE "template_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"template_slug" text NOT NULL,
	"template_kind" text NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"employees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "template_installations_company_uq" ON "template_installations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "template_installations_template_slug_idx" ON "template_installations" USING btree ("template_slug");