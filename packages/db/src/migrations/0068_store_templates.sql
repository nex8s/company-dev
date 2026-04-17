CREATE TABLE "store_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"summary" text NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"employees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creator" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "store_templates_slug_idx" ON "store_templates" USING btree ("slug");
