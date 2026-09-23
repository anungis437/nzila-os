-- PLATFORM 0004: audit-gap canonical tables + required enums
-- Extracted from migrations-audit; FKs omitted for empty-DB apply safety.

DO $$ BEGIN
  CREATE TYPE public."ai_complexity" AS ENUM ('routine', 'moderate', 'complex', 'unprecedented');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."ai_triage_status" AS ENUM ('pending', 'accepted', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."clause_reasoning_status" AS ENUM ('suggested', 'accepted', 'rejected', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."compliance_alert_severity" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."compliance_alert_type" AS ENUM ('contract_violation', 'safety_violation', 'dispatch_non_compliance', 'reporting_overdue', 'grievance_spike', 'dues_non_remittance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."compliance_report_type" AS ENUM ('quarterly_review', 'annual_audit', 'incident_report', 'dispatch_fulfillment', 'grievance_summary', 'safety_inspection');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."copilot_action_type" AS ENUM ('timeline_summary', 'suggest_action', 'draft_response', 'explain_clause', 'risk_brief', 'custom_query');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."copilot_outcome" AS ENUM ('accepted', 'edited', 'rejected', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."dispatch_assignment_status" AS ENUM ('offered', 'accepted', 'declined', 'confirmed', 'completed', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."dispatch_request_status" AS ENUM ('open', 'partially_filled', 'filled', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."dispatch_rule_type" AS ENUM ('seniority', 'availability', 'skills_match', 'rotation', 'geographic_proximity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."employer_communication_status" AS ENUM ('draft', 'sent', 'received', 'acknowledged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."employer_communication_type" AS ENUM ('email', 'phone', 'meeting', 'letter', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."employer_contact_role" AS ENUM ('main', 'hr', 'labour_relations', 'legal', 'supervisor', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."employer_risk_band" AS ENUM ('low', 'moderate', 'elevated', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."grievance_event_type" AS ENUM ('created', 'status_changed', 'assigned', 'reassigned', 'note_added', 'document_uploaded', 'escalated', 'deadline_set', 'deadline_extended', 'meeting_scheduled', 'response_received', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."insight_report_type" AS ENUM ('trend_forecast', 'employer_hotspots', 'steward_capacity', 'arbitration_escalation', 'executive_summary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."insight_timeframe" AS ENUM ('30d', '60d', '90d', '6m', '12m');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."strategic_goal_category" AS ENUM ('membership', 'financial', 'advocacy', 'operations', 'education', 'organizing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public."strategic_goal_status" AS ENUM ('on-track', 'at-risk', 'delayed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tables

CREATE TABLE IF NOT EXISTS "ai_clause_reasonings" (
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

CREATE TABLE IF NOT EXISTS "ai_copilot_sessions" (
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

CREATE TABLE IF NOT EXISTS "ai_grievance_triages" (
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

CREATE TABLE IF NOT EXISTS "ai_insight_reports" (
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

CREATE TABLE IF NOT EXISTS "clause_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_id" uuid NOT NULL,
	"embedding_vector" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"alert_type" "compliance_alert_type" NOT NULL,
	"severity" "compliance_alert_severity" NOT NULL,
	"message" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "dispatch_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "dispatch_assignment_status" DEFAULT 'offered' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "dispatch_requests" (
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

CREATE TABLE IF NOT EXISTS "dispatch_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_type" "dispatch_rule_type" NOT NULL,
	"rule_definition" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "employer_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"grievance_id" uuid,
	"type" "employer_communication_type" NOT NULL,
	"status" "employer_communication_status" DEFAULT 'draft' NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"summary" text,
	"sender_name" varchar(255) NOT NULL,
	"sender_user_id" uuid,
	"recipient_name" varchar(255) NOT NULL,
	"recipient_contact_id" uuid,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"attachments" jsonb,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);

CREATE TABLE IF NOT EXISTS "employer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "employer_contact_role" DEFAULT 'main' NOT NULL,
	"title" varchar(255),
	"email" varchar(320),
	"phone" varchar(30),
	"preferred_method" "employer_communication_type" DEFAULT 'email',
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);

CREATE TABLE IF NOT EXISTS "employer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_id" uuid NOT NULL,
	"report_type" "compliance_report_type" NOT NULL,
	"data_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "employer_risk_scores" (
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

CREATE TABLE IF NOT EXISTS "governance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(50) DEFAULT 'hr' NOT NULL,
	"description" text,
	"content" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"updated_by" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "grievance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grievance_id" uuid NOT NULL,
	"event_type" "grievance_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_benefit_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"claim_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"submitted_date" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_date" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"period" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"membership_status" varchar(50) DEFAULT 'active' NOT NULL,
	"years_of_service" numeric(5, 1) DEFAULT '0' NOT NULL,
	"vesting_status" varchar(50) DEFAULT 'not_vested' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_name" varchar(255) NOT NULL,
	"plan_type" varchar(50) DEFAULT 'defined_benefit' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"total_assets" numeric(15, 2) DEFAULT '0' NOT NULL,
	"funding_status" numeric(5, 2) DEFAULT '100' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_t4a_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"tax_year" integer NOT NULL,
	"pension_income" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"generated_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_trustee_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"location" varchar(255),
	"agenda" text,
	"minutes" text,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pension_trustees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(255) NOT NULL,
	"role" varchar(100) DEFAULT 'trustee' NOT NULL,
	"appointed_date" timestamp with time zone DEFAULT now() NOT NULL,
	"term_end_date" timestamp with time zone,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stewards" (
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

CREATE TABLE IF NOT EXISTS "strategic_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" "strategic_goal_category" DEFAULT 'operations' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"owner" varchar(255),
	"status" "strategic_goal_status" DEFAULT 'on-track' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

