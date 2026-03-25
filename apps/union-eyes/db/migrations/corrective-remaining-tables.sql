-- Corrective Migration: Remaining Active Tables
-- Sources: domains/marketing.ts, domains/dispatch/dispatch.ts, board-packet-schema.ts
-- These schemas were NOT exported via db/schema/index.ts, so drizzle-kit missed them.

BEGIN;

-- ============================================================================
-- ENUMS: Marketing
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "metric_type" AS ENUM ('time-to-resolution','escalation-rate','member-satisfaction','organizer-workload','democratic-participation','governance-engagement');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "metric_visibility" AS ENUM ('public','pilot-only','internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "case_study_category" AS ENUM ('pilot','success-story','before-after','transformation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "pilot_status" AS ENUM ('submitted','review','approved','active','completed','declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "recognition_event_type" AS ENUM ('case-win','member-feedback','peer-recognition','milestone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "movement_trend_category" AS ENUM ('grievance-type','resolution-pattern','systemic-issue','sector-trend','jurisdiction-pattern');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "testimonial_type" AS ENUM ('organizer','member','executive','partner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- ENUMS: Dispatch
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "dispatch_request_status" AS ENUM ('open','partially_filled','filled','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "dispatch_assignment_status" AS ENUM ('offered','accepted','declined','confirmed','completed','no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "dispatch_rule_type" AS ENUM ('seniority','availability','skills_match','rotation','geographic_proximity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES: Marketing - Impact Metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS "impact_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "metric_type" "metric_type" NOT NULL,
  "value" numeric(10, 2) NOT NULL,
  "comparison_value" numeric(10, 2),
  "unit" text NOT NULL,
  "period" text NOT NULL,
  "visibility" "metric_visibility" NOT NULL DEFAULT 'internal',
  "anonymized" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "impact_metrics_org_metric_type_idx" ON "impact_metrics" ("organization_id", "metric_type");
CREATE INDEX IF NOT EXISTS "impact_metrics_visibility_idx" ON "impact_metrics" ("visibility");

-- ============================================================================
-- TABLES: Marketing - Case Studies
-- ============================================================================

CREATE TABLE IF NOT EXISTS "case_studies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "organization_type" text NOT NULL,
  "category" "case_study_category" NOT NULL,
  "summary" text NOT NULL,
  "challenge" text NOT NULL,
  "solution" text NOT NULL,
  "outcome" text NOT NULL,
  "metrics" jsonb NOT NULL,
  "testimonial" jsonb,
  "visibility" text NOT NULL DEFAULT 'public',
  "featured" boolean NOT NULL DEFAULT false,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "case_studies_category_idx" ON "case_studies" ("category");
CREATE INDEX IF NOT EXISTS "case_studies_featured_idx" ON "case_studies" ("featured");
CREATE INDEX IF NOT EXISTS "case_studies_published_idx" ON "case_studies" ("published_at");

-- ============================================================================
-- TABLES: Marketing - Testimonials
-- ============================================================================

CREATE TABLE IF NOT EXISTS "testimonials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" "testimonial_type" NOT NULL,
  "quote" text NOT NULL,
  "author" text NOT NULL,
  "role" text NOT NULL,
  "organization" text,
  "organization_type" text,
  "photo" text,
  "featured" boolean NOT NULL DEFAULT false,
  "visibility" text NOT NULL DEFAULT 'public',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "approved_at" timestamp
);

CREATE INDEX IF NOT EXISTS "testimonials_type_idx" ON "testimonials" ("type");
CREATE INDEX IF NOT EXISTS "testimonials_featured_idx" ON "testimonials" ("featured");

-- ============================================================================
-- TABLES: Marketing - Pilot Program
-- ============================================================================

CREATE TABLE IF NOT EXISTS "pilot_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  "status" "pilot_status" NOT NULL DEFAULT 'submitted',
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "reviewed_at" timestamp,
  "approved_at" timestamp,
  "responses" jsonb NOT NULL DEFAULT '{}',
  "notes" text
);

CREATE INDEX IF NOT EXISTS "pilot_applications_status_idx" ON "pilot_applications" ("status");
CREATE INDEX IF NOT EXISTS "pilot_applications_submitted_idx" ON "pilot_applications" ("submitted_at");

CREATE TABLE IF NOT EXISTS "pilot_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pilot_id" uuid NOT NULL REFERENCES "pilot_applications"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "enrollment_date" timestamp NOT NULL,
  "days_active" integer NOT NULL DEFAULT 0,
  "organizer_adoption_rate" numeric(5, 2) NOT NULL,
  "member_engagement_rate" numeric(5, 2) NOT NULL,
  "cases_managed" integer NOT NULL DEFAULT 0,
  "avg_time_to_resolution" numeric(10, 2) NOT NULL,
  "health_score" numeric(5, 2) NOT NULL,
  "milestones" jsonb NOT NULL,
  "last_calculated" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pilot_metrics_pilot_id_idx" ON "pilot_metrics" ("pilot_id");
CREATE INDEX IF NOT EXISTS "pilot_metrics_health_score_idx" ON "pilot_metrics" ("health_score");

-- ============================================================================
-- TABLES: Marketing - Organizer Recognition
-- ============================================================================

CREATE TABLE IF NOT EXISTS "organizer_impacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "cases_handled" integer NOT NULL DEFAULT 0,
  "cases_won" integer NOT NULL DEFAULT 0,
  "avg_resolution_time" numeric(10, 2) NOT NULL,
  "member_satisfaction_avg" numeric(3, 2) NOT NULL,
  "escalations_avoided" integer NOT NULL DEFAULT 0,
  "democratic_participation_rate" numeric(5, 2) NOT NULL,
  "recognition_events" jsonb NOT NULL,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "organizer_impacts_user_org_idx" ON "organizer_impacts" ("user_id", "organization_id");
CREATE INDEX IF NOT EXISTS "organizer_impacts_period_idx" ON "organizer_impacts" ("period_start", "period_end");

-- ============================================================================
-- TABLES: Marketing - Movement Insights
-- ============================================================================

CREATE TABLE IF NOT EXISTS "data_aggregation_consent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "consent_given" boolean NOT NULL DEFAULT false,
  "consent_date" timestamp NOT NULL,
  "categories" "movement_trend_category"[] NOT NULL,
  "expires_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "data_aggregation_consent_org_idx" ON "data_aggregation_consent" ("organization_id");

CREATE TABLE IF NOT EXISTS "movement_trends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" "movement_trend_category" NOT NULL,
  "dimension" text NOT NULL,
  "aggregated_count" integer NOT NULL,
  "organizations_contributing" integer NOT NULL,
  "timeframe" text NOT NULL,
  "insights" text NOT NULL,
  "legislative_brief_relevance" boolean NOT NULL DEFAULT false,
  "emerging_pattern" boolean NOT NULL DEFAULT false,
  "confidence_level" text NOT NULL DEFAULT 'medium',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "movement_trends_category_dimension_idx" ON "movement_trends" ("category", "dimension");
CREATE INDEX IF NOT EXISTS "movement_trends_timeframe_idx" ON "movement_trends" ("timeframe");
CREATE INDEX IF NOT EXISTS "movement_trends_emerging_idx" ON "movement_trends" ("emerging_pattern");

-- ============================================================================
-- TABLES: Dispatch
-- ============================================================================

CREATE TABLE IF NOT EXISTS "dispatch_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "employer_id" uuid NOT NULL,
  "job_title" varchar(255) NOT NULL,
  "required_skills" jsonb DEFAULT '[]',
  "requested_workers" integer NOT NULL DEFAULT 1,
  "status" "dispatch_request_status" NOT NULL DEFAULT 'open',
  "requested_date" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_dispatch_requests_org" ON "dispatch_requests" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_requests_employer" ON "dispatch_requests" ("employer_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_requests_status" ON "dispatch_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_dispatch_requests_date" ON "dispatch_requests" ("requested_date");

CREATE TABLE IF NOT EXISTS "dispatch_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" uuid NOT NULL REFERENCES "dispatch_requests"("id") ON DELETE CASCADE,
  "member_id" uuid NOT NULL,
  "status" "dispatch_assignment_status" NOT NULL DEFAULT 'offered',
  "assigned_at" timestamp with time zone NOT NULL DEFAULT now(),
  "responded_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_dispatch_assignments_request" ON "dispatch_assignments" ("request_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_assignments_member" ON "dispatch_assignments" ("member_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_assignments_status" ON "dispatch_assignments" ("status");

CREATE TABLE IF NOT EXISTS "dispatch_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "rule_type" "dispatch_rule_type" NOT NULL,
  "rule_definition" jsonb NOT NULL,
  "priority" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_dispatch_rules_org" ON "dispatch_rules" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_rules_type" ON "dispatch_rules" ("rule_type");

-- ============================================================================
-- TABLES: Board Packets
-- ============================================================================

CREATE TABLE IF NOT EXISTS "board_packets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" varchar(255) NOT NULL,
  "description" text,
  "packet_type" varchar(50) NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "fiscal_year" integer NOT NULL,
  "fiscal_quarter" integer,
  "generated_at" timestamp with time zone DEFAULT now(),
  "generated_by" varchar(255) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'draft',
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

CREATE TABLE IF NOT EXISTS "board_packet_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "packet_id" uuid NOT NULL REFERENCES "board_packets"("id") ON DELETE CASCADE,
  "section_type" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "order_index" integer NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS "board_packet_distributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "packet_id" uuid NOT NULL REFERENCES "board_packets"("id") ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS "board_packet_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "description" text,
  "packet_type" varchar(50) NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "sections" jsonb NOT NULL,
  "default_recipients" text[],
  "is_active" boolean DEFAULT true,
  "is_default" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "created_by" varchar(255) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now(),
  "updated_by" varchar(255)
);

COMMIT;
