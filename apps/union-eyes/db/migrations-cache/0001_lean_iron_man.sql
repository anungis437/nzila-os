CREATE TABLE "workbook_continuity_breakpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"breakpoint_id" varchar(64) NOT NULL,
	"scope" varchar(64) NOT NULL,
	"fragility_score" numeric(5, 2),
	"blast_radius" varchar(64),
	"narrative" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_governance_lineage_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"lineage_id" varchar(64) NOT NULL,
	"decision_date" timestamp with time zone,
	"summary" text NOT NULL,
	"interpretation_notes" text,
	"originating_holder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_memory_holders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"role" varchar(255) NOT NULL,
	"display_name" text,
	"responsibility" text NOT NULL,
	"tenure_band" varchar(32),
	"criticality" varchar(32),
	"successor_identified" boolean DEFAULT false NOT NULL,
	"stewardship_density" numeric(5, 2),
	"notes" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_modernization_alignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"axis_id" varchar(64) NOT NULL,
	"modernization_velocity" numeric(5, 2),
	"continuity_integrity" numeric(5, 2),
	"gap_score" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"module_id" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'not_started' NOT NULL,
	"payload" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"stripe_payment_ref" varchar(128) NOT NULL,
	"tier_id" varchar(64) NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'CAD' NOT NULL,
	"customer_email" varchar(320),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_stewardship_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"signal_id" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"category" varchar(64) NOT NULL,
	"statement" text NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_transformation_roadmap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"horizon" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sequencing_notes" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"locale" varchar(16) DEFAULT 'en-CA' NOT NULL,
	"doctrine_version" varchar(16) DEFAULT '1.0.0' NOT NULL,
	"consent" jsonb,
	"organization_context" jsonb,
	"sector_band" varchar(64),
	"institution_size_band" varchar(64),
	"report_tier_id" varchar(64),
	"stripe_payment_ref" varchar(128),
	"claim_email" varchar(320),
	"claim_token" varchar(128),
	"claimed_by_user_id" text,
	"claimed_org_id" uuid,
	"claimed_at" timestamp with time zone,
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workbook_continuity_breakpoints" ADD CONSTRAINT "workbook_continuity_breakpoints_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_governance_lineage_entries" ADD CONSTRAINT "workbook_governance_lineage_entries_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_governance_lineage_entries" ADD CONSTRAINT "workbook_governance_lineage_entries_originating_holder_id_workbook_memory_holders_id_fk" FOREIGN KEY ("originating_holder_id") REFERENCES "public"."workbook_memory_holders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_memory_holders" ADD CONSTRAINT "workbook_memory_holders_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_modernization_alignment" ADD CONSTRAINT "workbook_modernization_alignment_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_modules" ADD CONSTRAINT "workbook_modules_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_purchases" ADD CONSTRAINT "workbook_purchases_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_stewardship_signals" ADD CONSTRAINT "workbook_stewardship_signals_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_transformation_roadmap" ADD CONSTRAINT "workbook_transformation_roadmap_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workbook_continuity_breakpoints_workbook_idx" ON "workbook_continuity_breakpoints" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbook_governance_lineage_workbook_idx" ON "workbook_governance_lineage_entries" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbook_memory_holders_workbook_idx" ON "workbook_memory_holders" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbook_memory_holders_criticality_idx" ON "workbook_memory_holders" USING btree ("criticality");--> statement-breakpoint
CREATE INDEX "workbook_modernization_alignment_workbook_idx" ON "workbook_modernization_alignment" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbook_modules_workbook_idx" ON "workbook_modules" USING btree ("workbook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workbook_modules_workbook_module_uniq" ON "workbook_modules" USING btree ("workbook_id","module_id");--> statement-breakpoint
CREATE INDEX "workbook_purchases_workbook_idx" ON "workbook_purchases" USING btree ("workbook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workbook_purchases_stripe_ref_uniq" ON "workbook_purchases" USING btree ("stripe_payment_ref");--> statement-breakpoint
CREATE INDEX "workbook_stewardship_signals_workbook_idx" ON "workbook_stewardship_signals" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbook_transformation_roadmap_workbook_idx" ON "workbook_transformation_roadmap" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbooks_status_idx" ON "workbooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workbooks_created_idx" ON "workbooks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workbooks_claimed_by_idx" ON "workbooks" USING btree ("claimed_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workbooks_claim_token_uniq" ON "workbooks" USING btree ("claim_token");