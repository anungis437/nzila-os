CREATE TYPE "public"."case_study_category" AS ENUM('pilot', 'success-story', 'before-after', 'transformation');--> statement-breakpoint
CREATE TYPE "public"."metric_type" AS ENUM('time-to-resolution', 'escalation-rate', 'member-satisfaction', 'organizer-workload', 'democratic-participation', 'governance-engagement');--> statement-breakpoint
CREATE TYPE "public"."metric_visibility" AS ENUM('public', 'pilot-only', 'internal');--> statement-breakpoint
CREATE TYPE "public"."movement_trend_category" AS ENUM('grievance-type', 'resolution-pattern', 'systemic-issue', 'sector-trend', 'jurisdiction-pattern');--> statement-breakpoint
CREATE TYPE "public"."pilot_status" AS ENUM('submitted', 'review', 'approved', 'active', 'completed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."recognition_event_type" AS ENUM('case-win', 'member-feedback', 'peer-recognition', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."testimonial_type" AS ENUM('organizer', 'member', 'executive', 'partner');--> statement-breakpoint
CREATE TYPE "public"."dispatch_assignment_status" AS ENUM('offered', 'accepted', 'declined', 'confirmed', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."dispatch_request_status" AS ENUM('open', 'partially_filled', 'filled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."dispatch_rule_type" AS ENUM('seniority', 'availability', 'skills_match', 'rotation', 'geographic_proximity');--> statement-breakpoint
CREATE TABLE "case_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"organization_id" uuid,
	"organization_type" text NOT NULL,
	"category" "case_study_category" NOT NULL,
	"summary" text NOT NULL,
	"challenge" text NOT NULL,
	"solution" text NOT NULL,
	"outcome" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"testimonial" jsonb,
	"visibility" text DEFAULT 'public' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "case_studies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "data_aggregation_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp NOT NULL,
	"categories" "movement_trend_category"[] NOT NULL,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "data_aggregation_consent_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "impact_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"metric_type" "metric_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"comparison_value" numeric(10, 2),
	"unit" text NOT NULL,
	"period" text NOT NULL,
	"visibility" "metric_visibility" DEFAULT 'internal' NOT NULL,
	"anonymized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movement_trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "movement_trend_category" NOT NULL,
	"dimension" text NOT NULL,
	"aggregated_count" integer NOT NULL,
	"organizations_contributing" integer NOT NULL,
	"timeframe" text NOT NULL,
	"insights" text NOT NULL,
	"legislative_brief_relevance" boolean DEFAULT false NOT NULL,
	"emerging_pattern" boolean DEFAULT false NOT NULL,
	"confidence_level" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_impacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"cases_handled" integer DEFAULT 0 NOT NULL,
	"cases_won" integer DEFAULT 0 NOT NULL,
	"avg_resolution_time" numeric(10, 2) NOT NULL,
	"member_satisfaction_avg" numeric(3, 2) NOT NULL,
	"escalations_avoided" integer DEFAULT 0 NOT NULL,
	"democratic_participation_rate" numeric(5, 2) NOT NULL,
	"recognition_events" jsonb NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilot_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_name" text NOT NULL,
	"organization_type" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"member_count" integer NOT NULL,
	"jurisdictions" text[] NOT NULL,
	"sectors" text[] NOT NULL,
	"current_system" text,
	"challenges" text[] NOT NULL,
	"goals" text[] NOT NULL,
	"readiness_score" numeric(5, 2),
	"status" "pilot_status" DEFAULT 'submitted' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"approved_at" timestamp,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "pilot_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pilot_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"enrollment_date" timestamp NOT NULL,
	"days_active" integer DEFAULT 0 NOT NULL,
	"organizer_adoption_rate" numeric(5, 2) NOT NULL,
	"member_engagement_rate" numeric(5, 2) NOT NULL,
	"cases_managed" integer DEFAULT 0 NOT NULL,
	"avg_time_to_resolution" numeric(10, 2) NOT NULL,
	"health_score" numeric(5, 2) NOT NULL,
	"milestones" jsonb NOT NULL,
	"last_calculated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "testimonial_type" NOT NULL,
	"quote" text NOT NULL,
	"author" text NOT NULL,
	"role" text NOT NULL,
	"organization" text,
	"organization_type" text,
	"photo" text,
	"featured" boolean DEFAULT false NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dispatch_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "dispatch_assignment_status" DEFAULT 'offered' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dispatch_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"job_title" varchar(255) NOT NULL,
	"required_skills" jsonb DEFAULT '[]'::jsonb,
	"requested_workers" integer DEFAULT 1 NOT NULL,
	"status" "dispatch_request_status" DEFAULT 'open' NOT NULL,
	"requested_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_type" "dispatch_rule_type" NOT NULL,
	"rule_definition" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_packet_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"recipient_role" varchar(50) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"delivery_method" varchar(50) NOT NULL,
	"opened" boolean DEFAULT false,
	"opened_at" timestamp with time zone,
	"downloaded" boolean DEFAULT false,
	"downloaded_at" timestamp with time zone,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp with time zone,
	"acknowledgment_signature" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "board_packet_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"section_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"content" jsonb NOT NULL,
	"summary" text,
	"data_source" varchar(100),
	"data_query" text,
	"generated_at" timestamp with time zone DEFAULT now(),
	"is_confidential" boolean DEFAULT false,
	"required_role" varchar(50),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "board_packet_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"packet_type" varchar(50) NOT NULL,
	"organization_id" uuid,
	"sections" jsonb NOT NULL,
	"default_recipients" text[],
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "board_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"packet_type" varchar(50) NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_quarter" integer,
	"generated_at" timestamp with time zone DEFAULT now(),
	"generated_by" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp with time zone,
	"distributed_at" timestamp with time zone,
	"financial_summary" jsonb NOT NULL,
	"membership_stats" jsonb NOT NULL,
	"case_summary" jsonb NOT NULL,
	"motions_and_votes" jsonb,
	"audit_exceptions" jsonb,
	"compliance_status" jsonb NOT NULL,
	"action_items" jsonb,
	"recipient_roles" text[] NOT NULL,
	"distribution_list" jsonb,
	"pdf_url" text,
	"attachments" jsonb,
	"content_hash" varchar(255),
	"signed_by" varchar(255),
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_aggregation_consent" ADD CONSTRAINT "data_aggregation_consent_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_impacts" ADD CONSTRAINT "organizer_impacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_metrics" ADD CONSTRAINT "pilot_metrics_pilot_id_pilot_applications_id_fk" FOREIGN KEY ("pilot_id") REFERENCES "public"."pilot_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_metrics" ADD CONSTRAINT "pilot_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_request_id_dispatch_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dispatch_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packet_distributions" ADD CONSTRAINT "board_packet_distributions_packet_id_board_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."board_packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packet_sections" ADD CONSTRAINT "board_packet_sections_packet_id_board_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."board_packets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packet_templates" ADD CONSTRAINT "board_packet_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_packets" ADD CONSTRAINT "board_packets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_studies_category_idx" ON "case_studies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "case_studies_featured_idx" ON "case_studies" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "case_studies_published_idx" ON "case_studies" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "data_aggregation_consent_org_idx" ON "data_aggregation_consent" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "impact_metrics_org_metric_type_idx" ON "impact_metrics" USING btree ("organization_id","metric_type");--> statement-breakpoint
CREATE INDEX "impact_metrics_visibility_idx" ON "impact_metrics" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "movement_trends_category_dimension_idx" ON "movement_trends" USING btree ("category","dimension");--> statement-breakpoint
CREATE INDEX "movement_trends_timeframe_idx" ON "movement_trends" USING btree ("timeframe");--> statement-breakpoint
CREATE INDEX "movement_trends_emerging_idx" ON "movement_trends" USING btree ("emerging_pattern");--> statement-breakpoint
CREATE INDEX "organizer_impacts_user_org_idx" ON "organizer_impacts" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "organizer_impacts_period_idx" ON "organizer_impacts" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "pilot_applications_status_idx" ON "pilot_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pilot_applications_submitted_idx" ON "pilot_applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "pilot_metrics_pilot_id_idx" ON "pilot_metrics" USING btree ("pilot_id");--> statement-breakpoint
CREATE INDEX "pilot_metrics_health_score_idx" ON "pilot_metrics" USING btree ("health_score");--> statement-breakpoint
CREATE INDEX "testimonials_type_idx" ON "testimonials" USING btree ("type");--> statement-breakpoint
CREATE INDEX "testimonials_featured_idx" ON "testimonials" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_request" ON "dispatch_assignments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_member" ON "dispatch_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_assignments_status" ON "dispatch_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispatch_requests_org" ON "dispatch_requests" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_requests_employer" ON "dispatch_requests" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_requests_status" ON "dispatch_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dispatch_requests_date" ON "dispatch_requests" USING btree ("requested_date");--> statement-breakpoint
CREATE INDEX "idx_dispatch_rules_org" ON "dispatch_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_rules_type" ON "dispatch_rules" USING btree ("rule_type");