ALTER TYPE "public"."organization_type" ADD VALUE 'platform' BEFORE 'congress';--> statement-breakpoint
CREATE TABLE "org_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "org_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"storage_used_bytes" integer DEFAULT 0 NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL,
	"api_call_count" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp with time zone DEFAULT now(),
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'profiles'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "profiles" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD COLUMN "grievance_id" uuid;--> statement-breakpoint
ALTER TABLE "steward_assignments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "clerk_organization_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "app_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "org_configurations" ADD CONSTRAINT "org_configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_usage" ADD CONSTRAINT "org_usage_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_configurations_org_cat_key" ON "org_configurations" USING btree ("organization_id","category","key");--> statement-breakpoint
CREATE INDEX "idx_org_configurations_org" ON "org_configurations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_usage_org_period" ON "org_usage" USING btree ("organization_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_org_usage_org" ON "org_usage" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_organizations_app_id" ON "organizations" USING btree ("app_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id");