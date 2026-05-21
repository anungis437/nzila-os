CREATE TABLE "icra_anonymized_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benchmark_group_id" uuid,
	"dimension_id" varchar(64) NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"value" numeric(8, 3) NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_assessment_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" varchar(64) NOT NULL,
	"question_version" integer DEFAULT 1 NOT NULL,
	"raw_value" text NOT NULL,
	"normalized_score" numeric(6, 4) NOT NULL,
	"weights_snapshot" jsonb NOT NULL,
	"risk_inverted" boolean DEFAULT false NOT NULL,
	"note" text,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"status" varchar(16) DEFAULT 'in_progress' NOT NULL,
	"question_bank_version" integer DEFAULT 1 NOT NULL,
	"doctrine_version" varchar(16) DEFAULT '1.0.0' NOT NULL,
	"consent" jsonb,
	"organization_context" jsonb,
	"locale" varchar(16) DEFAULT 'en-CA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"report_tier_id" varchar(64) DEFAULT 'continuity_reflection' NOT NULL,
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "icra_benchmark_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sector" varchar(64),
	"jurisdiction" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "icra_benchmark_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "icra_continuity_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"dimension_id" varchar(64) NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"contributing_questions" integer NOT NULL,
	"weight_total" numeric(6, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_followup_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"recommendation_id" varchar(64) NOT NULL,
	"kind" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"cta_label" varchar(128) NOT NULL,
	"cta_href" varchar(512) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_governance_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"flag_id" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"category" varchar(32) NOT NULL,
	"statement" text NOT NULL,
	"evidence" jsonb
);
--> statement-breakpoint
CREATE TABLE "icra_maturity_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"maturity_band_id" varchar(64) NOT NULL,
	"composite" numeric(5, 2) NOT NULL,
	"profile_payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_operational_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"indicator_id" varchar(64) NOT NULL,
	"value" numeric(8, 3),
	"payload" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icra_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(255),
	"sector" varchar(64),
	"jurisdiction" varchar(64),
	"workforce_band" varchar(32),
	"governance_model" varchar(32),
	"federation_affiliation" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "icra_anonymized_metrics" ADD CONSTRAINT "icra_anonymized_metrics_benchmark_group_id_icra_benchmark_groups_id_fk" FOREIGN KEY ("benchmark_group_id") REFERENCES "public"."icra_benchmark_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_assessment_answers" ADD CONSTRAINT "icra_assessment_answers_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_assessments" ADD CONSTRAINT "icra_assessments_organization_id_icra_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."icra_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_continuity_scores" ADD CONSTRAINT "icra_continuity_scores_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_followup_recommendations" ADD CONSTRAINT "icra_followup_recommendations_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_governance_flags" ADD CONSTRAINT "icra_governance_flags_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_maturity_profiles" ADD CONSTRAINT "icra_maturity_profiles_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icra_operational_indicators" ADD CONSTRAINT "icra_operational_indicators_assessment_id_icra_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."icra_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "icra_metrics_group_idx" ON "icra_anonymized_metrics" USING btree ("benchmark_group_id");--> statement-breakpoint
CREATE INDEX "icra_metrics_dimension_idx" ON "icra_anonymized_metrics" USING btree ("dimension_id");--> statement-breakpoint
CREATE INDEX "icra_answers_assessment_idx" ON "icra_assessment_answers" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_answers_question_idx" ON "icra_assessment_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "icra_assessments_status_idx" ON "icra_assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "icra_assessments_created_idx" ON "icra_assessments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "icra_scores_assessment_idx" ON "icra_continuity_scores" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_scores_dimension_idx" ON "icra_continuity_scores" USING btree ("dimension_id");--> statement-breakpoint
CREATE INDEX "icra_recos_assessment_idx" ON "icra_followup_recommendations" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_flags_assessment_idx" ON "icra_governance_flags" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_flags_severity_idx" ON "icra_governance_flags" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "icra_profiles_assessment_idx" ON "icra_maturity_profiles" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_profiles_band_idx" ON "icra_maturity_profiles" USING btree ("maturity_band_id");--> statement-breakpoint
CREATE INDEX "icra_indicators_assessment_idx" ON "icra_operational_indicators" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "icra_orgs_sector_idx" ON "icra_organizations" USING btree ("sector");