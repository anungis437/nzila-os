-- ============================================================================
-- FIXUP MIGRATION: Create all tables present in snapshot but missing
-- from the actual SQL migration files.
--
-- Tables created: 27
-- Enums created: 6
-- ============================================================================

-- ============================================================================
-- SECTION 1: Enum Types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."arbitration_status" AS ENUM('pending', 'scheduled', 'in_progress', 'adjourned', 'reserved', 'award_rendered', 'settled', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."grievance_type" AS ENUM('individual', 'group', 'policy', 'contract', 'harassment', 'discrimination', 'safety', 'seniority', 'discipline', 'termination', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."grievance_status" AS ENUM('draft', 'filed', 'acknowledged', 'investigating', 'response_due', 'response_received', 'escalated', 'mediation', 'arbitration', 'settled', 'withdrawn', 'denied', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."grievance_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."grievance_step" AS ENUM('step_1', 'step_2', 'step_3', 'final', 'arbitration');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."settlement_type" AS ENUM('monetary', 'non_monetary', 'policy_change', ' reinstatement', 'apology', 'training', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ============================================================================
-- SECTION 2: Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "contribution_rates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "rate_type" varchar(50) NOT NULL,
  "rate_type_name" varchar(100),
  "rate" numeric(5, 4) NOT NULL,
  "max_insurable_earnings" numeric(12, 2),
  "exemption_limit" numeric(12, 2),
  "maximum_contribution" numeric(12, 2),
  "year" integer NOT NULL,
  "effective_date" varchar(20),
  "source" varchar(100) DEFAULT 'Canada Revenue Agency' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_of_living_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "cpi_value" numeric(10, 2) NOT NULL,
  "cpi_vector" varchar(50),
  "inflation_rate" numeric(5, 2) NOT NULL,
  "year" integer NOT NULL,
  "ref_date" varchar(20) NOT NULL,
  "source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_data_sync_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "source" varchar(100) NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "sync_id" varchar(100) NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "records_processed" integer DEFAULT 0,
  "records_inserted" integer DEFAULT 0,
  "records_updated" integer DEFAULT 0,
  "records_failed" integer DEFAULT 0,
  "error_message" text,
  "error_details" text,
  "initiated_by" varchar(100),
  "sync_type" varchar(50) DEFAULT 'manual' NOT NULL,
  "parameters" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "union_density" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "naics_code" varchar(10),
  "naics_name" varchar(255),
  "noc_code" varchar(10),
  "noc_name" varchar(255),
  "sex" varchar(1) DEFAULT 'B' NOT NULL,
  "age_group" varchar(50),
  "age_group_name" varchar(100),
  "citizenship" varchar(50),
  "citizenship_name" varchar(100),
  "union_status" varchar(50) NOT NULL,
  "union_status_name" varchar(100) NOT NULL,
  "density_value" numeric(5, 2) NOT NULL,
  "ref_date" varchar(20) NOT NULL,
  "survey_year" integer NOT NULL,
  "source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wage_benchmarks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "noc_code" varchar(10) NOT NULL,
  "noc_name" varchar(255) NOT NULL,
  "noc_category" varchar(100),
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "geography_type" varchar(20) DEFAULT 'national' NOT NULL,
  "naics_code" varchar(10),
  "naics_name" varchar(255),
  "wage_value" numeric(12, 2) NOT NULL,
  "wage_unit" varchar(20) DEFAULT 'hourly' NOT NULL,
  "wage_type" varchar(50) NOT NULL,
  "sex" varchar(1) DEFAULT 'B' NOT NULL,
  "age_group" varchar(50),
  "age_group_name" varchar(100),
  "education_level" varchar(50),
  "statistics_type" varchar(100),
  "data_type" varchar(100),
  "ref_date" varchar(20) NOT NULL,
  "survey_year" integer NOT NULL,
  "source" varchar(100) DEFAULT 'Statistics Canada' NOT NULL,
  "data_quality_symbol" varchar(10),
  "is_terminated" boolean DEFAULT false,
  "decimals" integer DEFAULT 2,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lrb_agreements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "source" varchar(50) NOT NULL,
  "source_id" varchar(100) NOT NULL,
  "employer_name" varchar(500) NOT NULL,
  "employer_address" text,
  "union_name" varchar(500) NOT NULL,
  "union_code" varchar(50),
  "bargaining_unit" varchar(500),
  "bargaining_unit_size" integer,
  "agreement_date" varchar(20),
  "effective_date" timestamp with time zone,
  "expiry_date" timestamp with time zone,
  "ratification_date" timestamp with time zone,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "sector" varchar(50),
  "industry_code" varchar(20),
  "industry_name" varchar(255),
  "geographic_scope" varchar(100),
  "jurisdiction" varchar(10) NOT NULL,
  "hourly_wage_range" varchar(100),
  "annual_salary_range" varchar(100),
  "pdf_url" varchar(1000),
  "html_url" varchar(1000),
  "json_url" varchar(1000),
  "extracted_content" text,
  "key_terms" jsonb,
  "search_keywords" text,
  "noc_codes" text,
  "occupation_category" varchar(100),
  "embedding_vector" text,
  "ai_summary" text,
  "sentiment_score" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_synced_at" timestamp with time zone,
  "sync_id" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lrb_employers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "employer_name" varchar(500) NOT NULL,
  "employer_name_alt" varchar(500),
  "jurisdiction" varchar(10) NOT NULL,
  "city" varchar(100),
  "province" varchar(100),
  "industry_code" varchar(20),
  "industry_name" varchar(255),
  "total_agreements" integer DEFAULT 0,
  "active_agreements" integer DEFAULT 0,
  "last_agreement_date" varchar(20),
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lrb_sync_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "source" varchar(50) NOT NULL,
  "sync_id" varchar(100) NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "pages_processed" integer DEFAULT 0,
  "agreements_found" integer DEFAULT 0,
  "agreements_inserted" integer DEFAULT 0,
  "agreements_updated" integer DEFAULT 0,
  "agreements_failed" integer DEFAULT 0,
  "error_message" text,
  "error_details" text,
  "sync_type" varchar(50) DEFAULT 'full' NOT NULL,
  "parameters" text,
  "initiated_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lrb_unions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "union_name" varchar(500) NOT NULL,
  "union_code" varchar(50),
  "acronym" varchar(20),
  "parent_organization" varchar(500),
  "affiliation_level" varchar(50),
  "primary_jurisdiction" varchar(10),
  "total_agreements" integer DEFAULT 0,
  "active_agreements" integer DEFAULT 0,
  "total_members" integer,
  "last_agreement_date" varchar(20),
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clc_bargaining_trends" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "sector" varchar(100) NOT NULL,
  "sub_sector" varchar(100),
  "bargaining_unit_size" varchar(50),
  "year" integer NOT NULL,
  "quarter" integer,
  "total_agreements" integer,
  "settled_agreements" integer,
  "unsettled_agreements" integer,
  "strikes_lockouts" integer,
  "average_wage_increase" numeric(5, 2),
  "median_wage_increase" numeric(5, 2),
  "range_low" numeric(5, 2),
  "range_high" numeric(5, 2),
  "average_duration_months" integer,
  "cola_settlements" numeric(5, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100),
  "source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clc_oauth_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_type" varchar(50) DEFAULT 'Bearer',
  "scopes" text,
  "expires_at" timestamp with time zone,
  "refresh_expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clc_per_capita_benchmarks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" varchar(255) NOT NULL,
  "organization_name" varchar(500) NOT NULL,
  "organization_type" varchar(100),
  "fiscal_year" integer NOT NULL,
  "quarter" integer,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "total_members" integer NOT NULL,
  "dues_paying_members" integer,
  "active_members" integer,
  "per_capita_rate" numeric(10, 4),
  "total_remittance" numeric(12, 2),
  "currency" varchar(3) DEFAULT 'CAD',
  "national_average_rate" numeric(10, 4),
  "provincial_average_rate" numeric(10, 4),
  "percentile_rank" integer,
  "size_category_comparison" varchar(50),
  "sector_comparison" varchar(50),
  "is_verified" boolean DEFAULT false,
  "verification_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100),
  "source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clc_union_density" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "sector" varchar(100) NOT NULL,
  "sub_sector" varchar(100),
  "industry_code" varchar(20),
  "jurisdiction" varchar(10) NOT NULL,
  "region_name" varchar(255),
  "year" integer NOT NULL,
  "month" integer,
  "total_workforce" integer,
  "union_members" integer,
  "union_covered" integer,
  "density_percent" numeric(5, 2),
  "coverage_percent" numeric(5, 2),
  "year_over_year_change" numeric(5, 2),
  "month_over_month_change" numeric(5, 2),
  "national_density" numeric(5, 2),
  "provincial_density" numeric(5, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sync_id" varchar(100),
  "source" varchar(50) DEFAULT 'clc_partnership'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "award_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "template_id" uuid NOT NULL,
  "recipient_id" varchar(255) NOT NULL,
  "recipient_name" varchar(255) NOT NULL,
  "recipient_email" varchar(255),
  "points_awarded" integer DEFAULT 0,
  "monetary_value" integer DEFAULT 0,
  "badge_awarded" boolean DEFAULT false,
  "giver_id" varchar(255) NOT NULL,
  "giver_name" varchar(255) NOT NULL,
  "reason" text,
  "visibility" varchar(20) DEFAULT 'public',
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "approved_by" varchar(255),
  "approved_at" timestamp with time zone,
  "redeemed_at" timestamp with time zone,
  "redemption_notes" text,
  "awarded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "award_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "message" text NOT NULL,
  "category" varchar(50) NOT NULL,
  "type" varchar(50) NOT NULL,
  "points_value" integer DEFAULT 0,
  "monetary_value" integer DEFAULT 0,
  "currency" varchar(3) DEFAULT 'CAD',
  "badge_name" varchar(100),
  "badge_icon" varchar(500),
  "badge_color" varchar(20),
  "tags" jsonb,
  "use_count" integer DEFAULT 0,
  "max_uses" integer,
  "per_user_limit" integer,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "organization_id" varchar(255),
  "requires_approval" boolean DEFAULT false,
  "approver_roles" jsonb,
  "total_awarded" integer DEFAULT 0,
  "total_value_awarded" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_pool" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "organization_id" varchar(255) NOT NULL,
  "total_budget" integer NOT NULL,
  "allocated_budget" integer DEFAULT 0 NOT NULL,
  "spent_budget" integer DEFAULT 0 NOT NULL,
  "fiscal_year" integer NOT NULL,
  "quarter" integer,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "manager_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_reservations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "pool_id" uuid NOT NULL,
  "reserved_amount" integer NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "reference_type" varchar(50) NOT NULL,
  "reference_id" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_execution_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "rule_id" uuid NOT NULL,
  "triggered_by" varchar(255) NOT NULL,
  "trigger_type" varchar(50) NOT NULL,
  "target_entity_type" varchar(50) NOT NULL,
  "target_entity_id" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL,
  "error_message" text,
  "error_details" jsonb,
  "actions_executed" jsonb,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "rule_id" uuid NOT NULL,
  "schedule_type" varchar(50) NOT NULL,
  "schedule_config" jsonb,
  "next_run_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arbitrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "grievance_id" uuid NOT NULL,
  "arbitration_number" varchar(50) NOT NULL,
  "board_name" varchar(255) NOT NULL,
  "board_type" varchar(100) NOT NULL,
  "arbitrator_ids" uuid[],
  "arbitrator_names" varchar(255)[],
  "union_appointee" varchar(255),
  "employer_appointee" varchar(255),
  "chair_appointee" varchar(255),
  "status" arbitration_status DEFAULT 'pending' NOT NULL,
  "scheduled_date" timestamp with time zone,
  "location" varchar(500),
  "virtual_meeting_url" varchar(500),
  "submission_deadline" timestamp with time zone,
  "evidence_deadline" timestamp with time zone,
  "reply_deadline" timestamp with time zone,
  "hearing_days" integer[],
  "hearing_dates" timestamp with time zone[],
  "adjourned_to" timestamp with time zone,
  "award_deadline" timestamp with time zone,
  "award_date" timestamp with time zone,
  "award" text,
  "award_summary" text,
  "union_cost_share" integer,
  "employer_cost_share" integer,
  "estimated_cost" integer,
  "actual_cost" integer,
  "submissions" jsonb,
  "exhibits" jsonb,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "grievance_id" uuid NOT NULL,
  "response_number" integer NOT NULL,
  "responding_party" varchar(100) NOT NULL,
  "responder_name" varchar(255),
  "responder_title" varchar(255),
  "response" text NOT NULL,
  "position" text,
  "response_date" timestamp with time zone NOT NULL,
  "received_date" timestamp with time zone,
  "accepted_by_grievant" boolean,
  "accepted_by_employer" boolean,
  "next_deadline" timestamp with time zone,
  "next_step" varchar(100),
  "attachments" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_timeline" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "grievance_id" uuid NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "event_date" timestamp with time zone NOT NULL,
  "actor" varchar(255),
  "actor_role" varchar(100),
  "description" text NOT NULL,
  "notes" text,
  "attachments" jsonb,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievances" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "grievance_number" varchar(50) NOT NULL,
  "type" grievance_type NOT NULL,
  "status" grievance_status DEFAULT 'draft' NOT NULL,
  "priority" grievance_priority DEFAULT 'medium',
  "step" grievance_step,
  "grievant_id" uuid,
  "grievant_name" varchar(255),
  "grievant_email" varchar(255),
  "union_rep_id" uuid,
  "employer_rep_id" varchar(255),
  "employer_id" uuid,
  "employer_name" varchar(255),
  "workplace_id" uuid,
  "workplace_name" varchar(255),
  "cba_id" uuid,
  "cba_article" varchar(100),
  "cba_section" varchar(100),
  "title" varchar(500) NOT NULL,
  "description" text NOT NULL,
  "background" text,
  "desired_outcome" text,
  "incident_date" timestamp with time zone,
  "filed_date" timestamp with time zone,
  "response_deadline" timestamp with time zone,
  "meeting_date" timestamp with time zone,
  "escalated_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "timeline" jsonb,
  "group_grievance_id" uuid,
  "related_grievance_ids" uuid[],
  "attachments" jsonb,
  "is_group_grievance" boolean DEFAULT false,
  "is_arbitration_eligible" boolean DEFAULT false,
  "has_legal_implications" boolean DEFAULT false,
  "is_confidential" boolean DEFAULT false,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "last_updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settlements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "grievance_id" uuid NOT NULL,
  "arbitration_id" uuid,
  "settlement_type" settlement_type NOT NULL,
  "status" varchar(50) DEFAULT 'proposed' NOT NULL,
  "monetary_amount" integer,
  "monetary_details" text,
  "non_monetary_terms" jsonb,
  "implemented_at" timestamp with time zone,
  "implementation_notes" text,
  "compliance_deadline" timestamp with time zone,
  "compliance_status" varchar(50),
  "compliance_notes" text,
  "approved_by_grievant" boolean,
  "approved_by_employer" boolean,
  "approved_by_union" boolean,
  "approval_dates" timestamp with time zone[],
  "agreement_url" varchar(500),
  "confidentiality" boolean DEFAULT false,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "defensibility_packs" (
  "pack_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "case_id" uuid NOT NULL,
  "case_number" varchar(50) NOT NULL,
  "organization_id" uuid NOT NULL,
  "pack_version" varchar(10) DEFAULT '1.0.0' NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "generated_by" varchar(255) NOT NULL,
  "export_format" varchar(10) NOT NULL,
  "export_purpose" varchar(50) NOT NULL,
  "requested_by" varchar(255),
  "pack_data" jsonb NOT NULL,
  "integrity_hash" varchar(64) NOT NULL,
  "timeline_hash" varchar(64) NOT NULL,
  "audit_hash" varchar(64) NOT NULL,
  "state_transition_hash" varchar(64) NOT NULL,
  "verification_status" varchar(20) DEFAULT 'verified' NOT NULL,
  "last_verified_at" timestamp with time zone,
  "verification_attempts" integer DEFAULT 0,
  "download_count" integer DEFAULT 0,
  "last_downloaded_at" timestamp with time zone,
  "last_downloaded_by" varchar(255),
  "file_size_bytes" integer,
  "storage_location" text,
  "deleted_at" timestamp with time zone,
  "deleted_by" varchar(255),
  "deletion_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pack_download_log" (
  "log_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "pack_id" uuid NOT NULL,
  "case_number" varchar(50) NOT NULL,
  "organization_id" uuid NOT NULL,
  "downloaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "downloaded_by" varchar(255) NOT NULL,
  "downloaded_by_role" varchar(50),
  "download_purpose" varchar(100),
  "ip_address" varchar(45),
  "user_agent" text,
  "export_format" varchar(10) NOT NULL,
  "file_size_bytes" integer,
  "integrity_verified" boolean DEFAULT true,
  "download_success" boolean DEFAULT true,
  "error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pack_verification_log" (
  "verification_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "pack_id" uuid NOT NULL,
  "case_number" varchar(50) NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_by" varchar(255),
  "verification_passed" boolean NOT NULL,
  "expected_hash" varchar(64) NOT NULL,
  "actual_hash" varchar(64),
  "failure_reason" text,
  "tampered_fields" jsonb,
  "verification_trigger" varchar(50)
);
--> statement-breakpoint

-- ============================================================================
-- SECTION 3: Enum Value Extension (required before migration 0008)
-- ============================================================================
-- Migration 0001 created alert_severity with ('info','warning','urgent','critical').
-- Migration 0008 creates tables with DEFAULT 'medium' on alert_severity columns.
-- ALTER TYPE ADD VALUE cannot run inside a transaction, so we rename + recreate the
-- enum with the full value set using a transaction-safe pattern.
ALTER TYPE "public"."alert_severity" RENAME TO "_alert_severity_old";
--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'urgent', 'critical', 'high', 'medium', 'low');
--> statement-breakpoint
ALTER TABLE "deadline_alerts" ALTER COLUMN "alert_severity" SET DATA TYPE "public"."alert_severity" USING "alert_severity"::text::"public"."alert_severity";
--> statement-breakpoint
DROP TYPE "_alert_severity_old";
--> statement-breakpoint