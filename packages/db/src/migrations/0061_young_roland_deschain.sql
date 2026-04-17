CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tool_kind" text NOT NULL,
	"label" text NOT NULL,
	"token" text NOT NULL,
	"refresh_token" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_company_idx" ON "connections" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_company_tool_label_uq" ON "connections" USING btree ("company_id","tool_kind","label");
