-- =============================================================================
-- Corrective Migration: Active Tables Missing from Database
-- =============================================================================
-- Generated: 2026-03-25 08:38:15
-- Source: Drizzle migration 0000_familiar_silhouette.sql (519 tables)
-- Purpose: Create 55 tables that are ACTIVELY referenced by
--          services/routes but missing from the PostgreSQL database
-- Skipped: 16 platform-economics tables (already created)
-- Not found in migration: 13 tables (ab_tests, ab_test_variants,
--   board_packet_distributions, board_packets, case_studies,
--   data_aggregation_consent, dispatch_assignments, dispatch_requests,
--   dispatch_rules, impact_metrics, pilot_applications, pilot_metrics,
--   testimonials)
-- =============================================================================

-- =============================================================================
-- PART 1: CREATE TYPE (enum) statements - 44 new enum types
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE "public"."a11y_issue_severity" AS ENUM('critical', 'serious', 'moderate', 'minor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."a11y_issue_status" AS ENUM('open', 'in_progress', 'resolved', 'wont_fix', 'duplicate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."address_status" AS ENUM('active', 'inactive', 'unverified', 'invalid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."address_type" AS ENUM('mailing', 'residential', 'business', 'billing', 'shipping', 'temporary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ai_complexity" AS ENUM('routine', 'moderate', 'complex', 'unprecedented');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ai_triage_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."alert_execution_status" AS ENUM('pending', 'running', 'success', 'failed', 'skipped', 'rate_limited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."alert_frequency" AS ENUM('once', 'every_occurrence', 'daily_digest', 'hourly_digest', 'rate_limited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."alert_trigger_type" AS ENUM('schedule', 'event', 'threshold', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."attendee_status" AS ENUM('invited', 'accepted', 'declined', 'tentative', 'no_response');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."audit_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."audit_type" AS ENUM('internal', 'external', 'certification', 'compliance', 'management_system', 'contractor', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."authentication_method" AS ENUM('email', 'sms', 'phone_call', 'knowledge_based', 'id_verification', 'multi_factor', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."claim_type" AS ENUM('grievance_discipline', 'grievance_schedule', 'grievance_pay', 'workplace_safety', 'discrimination_age', 'discrimination_gender', 'discrimination_race', 'discrimination_disability', 'discrimination_other', 'harassment_sexual', 'harassment_workplace', 'wage_dispute', 'contract_dispute', 'retaliation', 'wrongful_termination', 'other', 'harassment_verbal', 'harassment_physical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."clause_reasoning_status" AS ENUM('suggested', 'accepted', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."committee_member_role" AS ENUM('chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."congress_membership_status" AS ENUM('active', 'suspended', 'expired', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."consent_status" AS ENUM('granted', 'denied', 'withdrawn', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."copilot_action_type" AS ENUM('timeline_summary', 'suggest_action', 'draft_response', 'explain_clause', 'risk_brief', 'custom_query');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."copilot_outcome" AS ENUM('accepted', 'edited', 'rejected', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."delivery_method" AS ENUM('email', 'sms', 'push', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."employer_risk_band" AS ENUM('low', 'moderate', 'elevated', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'layoff', 'suspended', 'terminated', 'retired', 'deceased');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'casual', 'seasonal', 'temporary', 'contract', 'probationary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."insight_report_type" AS ENUM('trend_forecast', 'employer_hotspots', 'steward_capacity', 'arbitration_escalation', 'executive_summary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."insight_timeframe" AS ENUM('30d', '60d', '90d', '6m', '12m');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."integration_provider" AS ENUM('workday', 'bamboohr', 'adp', 'ceridian_dayforce', 'ukg_pro', 'quickbooks', 'xero', 'sage_intacct', 'freshbooks', 'wave', 'sunlife', 'manulife', 'blue_cross', 'green_shield', 'canada_life', 'otpp', 'cpp_qpp', 'provincial_pension', 'linkedin_learning', 'udemy', 'coursera', 'slack', 'microsoft_teams', 'sharepoint', 'google_drive', 'dropbox', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."integration_type" AS ENUM('hris', 'accounting', 'insurance', 'pension', 'lms', 'communication', 'document_management', 'calendar', 'social_media', 'payment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."leave_type" AS ENUM('vacation', 'sick', 'maternity', 'paternity', 'parental', 'bereavement', 'medical', 'disability', 'union_business', 'unpaid', 'lwop', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'function');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."pay_frequency" AS ENUM('hourly', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual', 'per_diem');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."shift_type" AS ENUM('day', 'evening', 'night', 'rotating', 'split', 'on_call');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."signature_document_status" AS ENUM('draft', 'sent', 'delivered', 'viewed', 'signed', 'completed', 'declined', 'voided', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."signature_provider" AS ENUM('docusign', 'hellosign', 'adobe_sign', 'pandadoc', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."signature_type" AS ENUM('electronic', 'digital', 'wet', 'clickwrap');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."signature_workflow_status" AS ENUM('draft', 'sent', 'in_progress', 'completed', 'declined', 'cancelled', 'expired', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."signer_status" AS ENUM('pending', 'sent', 'delivered', 'viewed', 'signed', 'declined', 'authentication_failed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."steward_type" AS ENUM('chief_steward', 'steward', 'alternate_steward', 'health_safety_rep');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."sync_type" AS ENUM('full', 'incremental', 'real_time');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ticket_category" AS ENUM('bug_report', 'feature_request', 'technical_support', 'account_issue', 'billing_question', 'data_issue', 'performance', 'security_concern', 'training_request', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."wcag_level" AS ENUM('A', 'AA', 'AAA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processing', 'processed', 'failed', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 2: CREATE TABLE statements - 55 active tables
-- =============================================================================
-- Note: Some tables have FK references to other tables. If those tables
-- don't exist yet, the FK constraint will fail. The base schema tables
-- should already be in place before running this migration.
-- =============================================================================

CREATE TABLE "accessibility_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"audit_name" text NOT NULL,
	"audit_type" text NOT NULL,
	"target_url" text NOT NULL,
	"target_environment" text NOT NULL,
	"wcag_version" text DEFAULT '2.2' NOT NULL,
	"conformance_level" "wcag_level" DEFAULT 'AA' NOT NULL,
	"status" "audit_status" DEFAULT 'pending' NOT NULL,
	"tools_used" jsonb,
	"total_issues" integer DEFAULT 0 NOT NULL,
	"critical_issues" integer DEFAULT 0 NOT NULL,
	"serious_issues" integer DEFAULT 0 NOT NULL,
	"moderate_issues" integer DEFAULT 0 NOT NULL,
	"minor_issues" integer DEFAULT 0 NOT NULL,
	"accessibility_score" integer,
	"pages_scanned" integer DEFAULT 0 NOT NULL,
	"elements_scanned" integer DEFAULT 0 NOT NULL,
	"scan_duration_ms" integer,
	"report_url" text,
	"report_data" jsonb,
	"triggered_by" text,
	"scheduled_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accessibility_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"issue_title" text NOT NULL,
	"issue_description" text NOT NULL,
	"severity" "a11y_issue_severity" NOT NULL,
	"wcag_criteria" text NOT NULL,
	"wcag_level" "wcag_level" NOT NULL,
	"wcag_title" text NOT NULL,
	"wcag_url" text,
	"page_url" text NOT NULL,
	"element_selector" text,
	"element_html" text,
	"element_xpath" text,
	"context" jsonb,
	"fix_suggestion" text,
	"code_example" text,
	"impacted_users" text,
	"affects_screen_readers" boolean DEFAULT false NOT NULL,
	"affects_keyboard_nav" boolean DEFAULT false NOT NULL,
	"affects_color_blindness" boolean DEFAULT false NOT NULL,
	"status" "a11y_issue_status" DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_notes" text,
	"verified_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"changed_by" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"change_reason" text,
	"change_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_validation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_hash" text NOT NULL,
	"country_code" text NOT NULL,
	"address_line_1" text NOT NULL,
	"locality" text NOT NULL,
	"administrative_area" text,
	"postal_code" text,
	"is_valid" boolean NOT NULL,
	"validated_by" text NOT NULL,
	"confidence" text,
	"corrected_address" jsonb,
	"latitude" text,
	"longitude" text,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"last_hit_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "address_validation_cache_input_hash_unique" UNIQUE("input_hash")
);
--> statement-breakpoint
CREATE TABLE "ai_clause_reasonings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"cba_id" uuid,
	"clause_article" varchar(100) NOT NULL,
	"clause_section" varchar(100),
	"clause_title" varchar(500),
	"clause_snippet" text,
	"relevance_score" numeric(5, 4) NOT NULL,
	"reasoning" text NOT NULL,
	"application_notes" text,
	"precedent_refs" jsonb,
	"strength_assessment" varchar(20),
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"factors_json" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"status" "clause_reasoning_status" DEFAULT 'suggested' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_copilot_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"action_type" "copilot_action_type" NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"query" text,
	"response_text" text NOT NULL,
	"structured_output" jsonb,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"sources_used" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"outcome" "copilot_outcome" DEFAULT 'pending' NOT NULL,
	"edited_response" text,
	"feedback_rating" numeric(3, 2),
	"feedback_notes" text,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_grievance_triages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"grievance_id" uuid NOT NULL,
	"suggested_priority" varchar(20) NOT NULL,
	"suggested_category" varchar(50) NOT NULL,
	"complexity" "ai_complexity" NOT NULL,
	"estimated_days_to_resolve" numeric,
	"suggested_step" varchar(30),
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"factors_json" jsonb,
	"similar_grievance_ids" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"status" "ai_triage_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"human_approved" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insight_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_type" "insight_report_type" NOT NULL,
	"timeframe" "insight_timeframe" NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"insights_json" jsonb NOT NULL,
	"predictions_json" jsonb,
	"recommendations_json" jsonb,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"data_sources_used" jsonb,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_safety_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" text NOT NULL,
	"output" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flagged_categories" jsonb,
	"confidence_scores" jsonb,
	"action" text NOT NULL,
	"reason" text,
	"session_id" uuid,
	"message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"trigger_type" "alert_trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"severity" "alert_severity" DEFAULT 'medium' NOT NULL,
	"frequency" "alert_frequency" DEFAULT 'every_occurrence' NOT NULL,
	"rate_limit_minutes" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"last_executed_at" timestamp with time zone,
	"last_execution_status" "alert_execution_status",
	"execution_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"tokens_used" integer,
	"response_time_ms" integer,
	"retrieved_documents" jsonb,
	"citations" jsonb,
	"function_calls" jsonb,
	"helpful" boolean,
	"feedback_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"role" "committee_member_role" DEFAULT 'member' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"term_number" integer DEFAULT 1,
	"appointment_method" varchar(50),
	"appointed_by" text,
	"election_date" date,
	"votes_received" integer,
	"meetings_attended" integer DEFAULT 0,
	"meetings_total" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "congress_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"congress_id" uuid NOT NULL,
	"status" "congress_membership_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contribution_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "country_address_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"iso3_code" text,
	"locality_label" text DEFAULT 'City' NOT NULL,
	"administrative_area_label" text DEFAULT 'State',
	"postal_code_label" text DEFAULT 'Postal Code',
	"sub_administrative_area_label" text,
	"required_fields" jsonb,
	"optional_fields" jsonb,
	"address_format" text NOT NULL,
	"display_order" jsonb,
	"postal_code_required" boolean DEFAULT true NOT NULL,
	"postal_code_pattern" text,
	"postal_code_example" text,
	"postal_code_length" integer,
	"administrative_areas" jsonb,
	"has_subdivisions" boolean DEFAULT false NOT NULL,
	"validation_rules" jsonb,
	"geocoding_supported" boolean DEFAULT true NOT NULL,
	"preferred_geocoder" text,
	"standardization_provider" text,
	"standardization_available" boolean DEFAULT false NOT NULL,
	"example_addresses" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "country_address_formats_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "course_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_code" varchar(50) NOT NULL,
	"session_name" varchar(300),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"session_times" jsonb,
	"delivery_method" varchar(50) NOT NULL,
	"venue_name" varchar(200),
	"venue_address" text,
	"room_number" varchar(50),
	"virtual_meeting_url" text,
	"virtual_meeting_access_code" varchar(50),
	"lead_instructor_id" varchar(255),
	"lead_instructor_name" varchar(200),
	"co_instructors" jsonb,
	"registration_open_date" date,
	"registration_close_date" date,
	"registration_count" integer DEFAULT 0,
	"waitlist_count" integer DEFAULT 0,
	"max_enrollment" integer,
	"session_status" varchar(50) DEFAULT 'scheduled',
	"attendees_count" integer DEFAULT 0,
	"completions_count" integer DEFAULT 0,
	"completion_rate" numeric(5, 2),
	"average_rating" numeric(3, 2),
	"evaluation_responses_count" integer DEFAULT 0,
	"session_budget" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"travel_subsidy_offered" boolean DEFAULT false,
	"accommodation_arranged" boolean DEFAULT false,
	"accommodation_hotel" varchar(200),
	"materials_prepared" boolean DEFAULT false,
	"materials_distributed_count" integer DEFAULT 0,
	"cancellation_reason" text,
	"cancelled_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" varchar(255),
	CONSTRAINT "course_sessions_session_code_key" UNIQUE("session_code")
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_folder_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"signature_type" "signature_type",
	"signature_image_url" text,
	"authentication_method" "authentication_method",
	"authenticated_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"reassigned_to" text,
	"reassigned_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"geolocation" jsonb,
	"provider_signer_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer_risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"overall_score" numeric(5, 4) NOT NULL,
	"risk_band" "employer_risk_band" NOT NULL,
	"trend_direction" varchar(15) NOT NULL,
	"signals_json" jsonb NOT NULL,
	"grievance_count_30d" integer DEFAULT 0,
	"compliance_alert_count_30d" integer DEFAULT 0,
	"arbitration_count_12m" integer DEFAULT 0,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" text NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"profile_key" varchar(100) NOT NULL,
	"audit_ref" varchar(120),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_employment_id" uuid,
	"change_type" varchar(100) NOT NULL,
	"effective_date" date NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text,
	"status" "attendee_status" DEFAULT 'invited',
	"is_optional" boolean DEFAULT false,
	"is_organizer" boolean DEFAULT false,
	"responded_at" timestamp,
	"response_comment" text,
	"notification_sent" boolean DEFAULT false,
	"last_notification_at" timestamp,
	"external_attendee_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"claim_number" varchar(255) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"employee_name" varchar(500),
	"policy_number" varchar(255),
	"claim_type" varchar(100),
	"service_date" date,
	"submission_date" date NOT NULL,
	"processed_date" date,
	"claim_amount" numeric(12, 2) NOT NULL,
	"approved_amount" numeric(12, 2),
	"paid_amount" numeric(12, 2),
	"denied_amount" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"denial_reason" text,
	"provider_id" varchar(255),
	"provider_name" varchar(500),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_insurance_claims_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "external_insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"policy_number" varchar(255) NOT NULL,
	"policy_type" varchar(100),
	"employee_id" varchar(255) NOT NULL,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"coverage_amount" numeric(15, 2),
	"premium" numeric(12, 2),
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "external_insurance_policies_unique" UNIQUE("organization_id","external_provider","external_id")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'boolean' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"percentage" integer,
	"allowed_organizations" json,
	"allowed_users" json,
	"description" text,
	"tags" json DEFAULT '[]'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"last_modified_by" text,
	CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "governance_bylaws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"article" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"holiday_date" timestamp NOT NULL,
	"holiday_name" varchar(255) NOT NULL,
	"holiday_type" varchar(100) NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"applies_to" varchar(100) DEFAULT 'all' NOT NULL,
	"is_observed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insight_type" text NOT NULL,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"data_source" jsonb,
	"metrics" jsonb,
	"trend" text,
	"impact" text,
	"recommendations" jsonb,
	"action_required" boolean DEFAULT false,
	"action_deadline" timestamp,
	"estimated_benefit" text,
	"confidence_score" numeric,
	"related_entities" jsonb,
	"status" text DEFAULT 'new',
	"acknowledged_by" varchar(255),
	"acknowledged_at" timestamp,
	"dismissed_by" varchar(255),
	"dismissed_at" timestamp,
	"dismissal_reason" text,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "integration_type" NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"credentials" jsonb NOT NULL,
	"settings" jsonb,
	"webhook_url" text,
	"enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"sync_type" "sync_type" NOT NULL,
	"orgs" text[],
	"status" "sync_status" NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_created" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"cursor" text,
	"error" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "international_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"address_type" "address_type" DEFAULT 'mailing' NOT NULL,
	"status" "address_status" DEFAULT 'unverified' NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"address_line_3" text,
	"locality" text NOT NULL,
	"locality_type" text,
	"administrative_area" text,
	"administrative_area_type" text,
	"postal_code" text,
	"postal_code_type" text,
	"sub_administrative_area" text,
	"dependent_locality" text,
	"sorting_code" text,
	"formatted_address" text,
	"local_format" text,
	"latitude" text,
	"longitude" text,
	"geocoded_at" timestamp,
	"geocode_provider" text,
	"geocode_accuracy" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_by" text,
	"validated_at" timestamp,
	"validation_result" jsonb,
	"is_standardized" boolean DEFAULT false NOT NULL,
	"standardized_by" text,
	"standardized_at" timestamp,
	"standardized_data" jsonb,
	"deliverability" text,
	"delivery_point" text,
	"carrier_route" text,
	"metadata" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bargaining_unit_id" uuid,
	"job_code" varchar(100) NOT NULL,
	"job_title" varchar(255) NOT NULL,
	"job_family" varchar(255),
	"job_level" integer,
	"minimum_rate" numeric(10, 2),
	"maximum_rate" numeric(10, 2),
	"standard_rate" numeric(10, 2),
	"description" text,
	"requirements" jsonb,
	"is_active" boolean DEFAULT true,
	"effective_date" date,
	"expiry_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"subcategory" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"visibility" varchar(50) DEFAULT 'public' NOT NULL,
	"view_count" integer DEFAULT 0,
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"meta_description" text,
	"meta_keywords" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1,
	"published_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"author_user_id" text,
	"author_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "knowledge_base_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "member_employment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"employer_id" uuid,
	"worksite_id" uuid,
	"bargaining_unit_id" uuid,
	"employment_status" "employment_status" DEFAULT 'active' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"hire_date" date NOT NULL,
	"seniority_date" date NOT NULL,
	"termination_date" date,
	"expected_return_date" date,
	"seniority_years" numeric(10, 2),
	"adjusted_seniority_date" date,
	"seniority_adjustment_reason" text,
	"job_title" varchar(255) NOT NULL,
	"job_code" varchar(100),
	"job_classification" varchar(255),
	"job_level" integer,
	"department" varchar(255),
	"division" varchar(255),
	"pay_frequency" "pay_frequency" DEFAULT 'hourly' NOT NULL,
	"hourly_rate" numeric(10, 2),
	"base_salary" numeric(12, 2),
	"gross_wages" numeric(12, 2),
	"regular_hours_per_week" numeric(5, 2) DEFAULT '40.00',
	"regular_hours_per_period" numeric(7, 2),
	"shift_type" "shift_type",
	"shift_start_time" varchar(10),
	"shift_end_time" varchar(10),
	"operates_weekends" boolean DEFAULT false,
	"operates_24_hours" boolean DEFAULT false,
	"supervisor_name" varchar(255),
	"supervisor_id" uuid,
	"is_probationary" boolean DEFAULT false,
	"probation_end_date" date,
	"checkoff_authorized" boolean DEFAULT true,
	"checkoff_date" date,
	"rand_exempt" boolean DEFAULT false,
	"custom_fields" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_employment_id" uuid,
	"leave_type" "leave_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"expected_return_date" date,
	"actual_return_date" date,
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"affects_seniority" boolean DEFAULT false,
	"seniority_adjustment_days" integer,
	"affects_dues" boolean DEFAULT true,
	"dues_waiver_approved" boolean DEFAULT false,
	"reason" text,
	"notes" text,
	"documents" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "member_location_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"consent_status" varchar(20) DEFAULT 'never_asked' NOT NULL,
	"opted_in_at" timestamp,
	"opted_out_at" timestamp,
	"consent_purpose" text NOT NULL,
	"purpose_description" text,
	"foreground_only" boolean DEFAULT true NOT NULL,
	"allowed_during_strike" boolean DEFAULT false NOT NULL,
	"allowed_during_events" boolean DEFAULT false NOT NULL,
	"can_revoke_anytime" boolean DEFAULT true NOT NULL,
	"data_retention_hours" varchar(10) DEFAULT '24' NOT NULL,
	"auto_delete_enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"renewal_required" boolean DEFAULT true NOT NULL,
	"last_renewal_reminder" timestamp,
	"consent_text" text NOT NULL,
	"consent_version" varchar(10) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_location_consent_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "public_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"slug" varchar(200) NOT NULL,
	"title" varchar(500) NOT NULL,
	"excerpt" text,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" text[],
	"is_published" boolean DEFAULT false,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "role_tenure_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"role_type" varchar(100) NOT NULL,
	"role_title" varchar(255) NOT NULL,
	"role_level" varchar(50),
	"related_entity_type" varchar(50),
	"related_entity_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current_role" boolean DEFAULT true,
	"appointment_method" varchar(50),
	"election_date" date,
	"votes_received" integer,
	"vote_total" integer,
	"term_length" integer,
	"term_number" integer DEFAULT 1,
	"end_reason" varchar(100),
	"ended_by" text,
	"notes" text,
	"achievements" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "signature_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_description" text,
	"ip_address" varchar,
	"user_agent" text,
	"location" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"external_event_id" varchar(255),
	"provider_data" jsonb,
	"signature_id" varchar(255),
	"certificate_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" text NOT NULL,
	"event_description" text NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"actor_role" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"geolocation" jsonb,
	"metadata" jsonb,
	"hash_chain" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"document_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_hash" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"provider_document_id" text,
	"provider_envelope_id" text,
	"status" "signature_document_status" DEFAULT 'draft' NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"voided_at" timestamp,
	"voided_by" text,
	"void_reason" text,
	"expires_at" timestamp,
	"reminder_schedule" jsonb,
	"require_authentication" boolean DEFAULT false NOT NULL,
	"authentication_method" "authentication_method",
	"access_code" text,
	"sequential_signing" boolean DEFAULT false NOT NULL,
	"allow_decline" boolean DEFAULT true NOT NULL,
	"allow_reassign" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"signer_id" uuid NOT NULL,
	"signature_hash" varchar(255) NOT NULL,
	"certificate_hash" varchar(255),
	"is_verified" boolean DEFAULT false,
	"verification_method" varchar(100),
	"verification_result" jsonb,
	"certificate_chain" jsonb,
	"certificate_valid_from" timestamp,
	"certificate_valid_to" timestamp,
	"certificate_issuer" text,
	"tamper_detected" boolean DEFAULT false,
	"tamper_details" text,
	"signature_file" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified_at" timestamp,
	"verified_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "signature_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "signature_workflow_status" DEFAULT 'draft' NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"external_envelope_id" varchar(255) NOT NULL,
	"external_workflow_id" varchar(255),
	"total_signers" integer NOT NULL,
	"completed_signatures" integer DEFAULT 0,
	"sent_at" timestamp,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"reminder_frequency_days" integer DEFAULT 3,
	"last_reminder_sent_at" timestamp,
	"auto_reminders_enabled" boolean DEFAULT true,
	"workflow_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"voided_at" timestamp,
	"voided_by" varchar(255),
	"void_reason" text,
	CONSTRAINT "signature_workflows_external_envelope_id_unique" UNIQUE("external_envelope_id")
);
--> statement-breakpoint
CREATE TABLE "signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"member_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"signer_order" integer NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"external_signer_id" varchar(255),
	"signing_url" varchar(500),
	"signature_image" text,
	"ip_address" varchar,
	"user_agent" text,
	"last_reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"priority" "ticket_priority",
	"category" "ticket_category",
	"organization_tier" varchar(50),
	"response_time_minutes" integer NOT NULL,
	"resolution_time_minutes" integer NOT NULL,
	"business_hours_only" boolean DEFAULT true,
	"timezone" varchar(100) DEFAULT 'UTC',
	"escalation_enabled" boolean DEFAULT false,
	"escalation_threshold_minutes" integer,
	"escalation_to_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "social_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"analytics_date" date NOT NULL,
	"follower_count" integer DEFAULT 0,
	"follower_change" integer DEFAULT 0,
	"following_count" integer DEFAULT 0,
	"posts_published" integer DEFAULT 0,
	"total_impressions" integer DEFAULT 0,
	"total_reach" integer DEFAULT 0,
	"total_likes" integer DEFAULT 0,
	"total_comments" integer DEFAULT 0,
	"total_shares" integer DEFAULT 0,
	"total_engagements" integer DEFAULT 0,
	"engagement_rate" numeric(5, 2),
	"profile_visits" integer DEFAULT 0,
	"link_clicks" integer DEFAULT 0,
	"analytics_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_analytics_account_id_analytics_date_unique" UNIQUE("account_id","analytics_date")
);
--> statement-breakpoint
CREATE TABLE "steward_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"steward_id" text NOT NULL,
	"steward_type" "steward_type" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"worksite_id" uuid,
	"department" varchar(255),
	"shift" varchar(100),
	"floor" varchar(100),
	"area" varchar(255),
	"start_date" date NOT NULL,
	"end_date" date,
	"is_interim" boolean DEFAULT false,
	"appointed_by" text,
	"elected_date" date,
	"certification_date" date,
	"responsibility_areas" jsonb,
	"members_covered" integer,
	"training_completed" boolean DEFAULT false,
	"training_completion_date" date,
	"certification_expiry" date,
	"work_phone" varchar(50),
	"personal_phone" varchar(50),
	"preferred_contact_method" varchar(50),
	"availability_notes" text,
	"notes" text,
	"grievance_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "stewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"region" varchar(255),
	"specialization" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"max_caseload" integer DEFAULT 10 NOT NULL,
	"current_caseload" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"survey_type" varchar(50) DEFAULT 'general' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"allow_anonymous" boolean DEFAULT false NOT NULL,
	"allow_multiple_responses" boolean DEFAULT false NOT NULL,
	"require_authentication" boolean DEFAULT true NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"show_results" boolean DEFAULT false NOT NULL,
	"welcome_message" text,
	"thank_you_message" text,
	"response_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 2),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"is_automated" boolean DEFAULT false,
	"author_user_id" text,
	"author_email" varchar(255),
	"author_name" varchar(255),
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"field" varchar(100),
	"old_value" text,
	"new_value" text,
	"changed_by_user_id" text,
	"changed_by_name" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_uuid_mapping" (
	"user_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_uuid_mapping_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "voter_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"is_eligible" boolean DEFAULT true,
	"eligibility_reason" text,
	"voting_weight" numeric(5, 2) DEFAULT '1.0',
	"can_delegate" boolean DEFAULT false,
	"delegated_to" uuid,
	"restrictions" text[],
	"verification_status" varchar(20) DEFAULT 'pending',
	"voter_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_verification_status" CHECK ("voter_eligibility"."verification_status" IN ('pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "voting_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"receipt_id" varchar(255) NOT NULL,
	"vote_hash" varchar(255) NOT NULL,
	"signature" text NOT NULL,
	"audit_hash" varchar(255) NOT NULL,
	"previous_audit_hash" varchar(255),
	"voted_at" timestamp with time zone NOT NULL,
	"verification_code" varchar(100),
	"is_anonymous" boolean DEFAULT true,
	"chain_valid" boolean DEFAULT true,
	"tampered_indicators" text[],
	"audit_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "voting_audit_log_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE "voting_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"text" varchar(500) NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"verified" boolean DEFAULT false,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
