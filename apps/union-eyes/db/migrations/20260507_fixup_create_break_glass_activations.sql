-- ============================================================================
-- FIXUP MIGRATION: Create all tables present in snapshot but missing
-- from the actual SQL migration files.
--
-- Tables created: 169
-- Enums created: 12
-- ============================================================================

-- ============================================================================
-- SECTION 1: Enum Types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."membership" AS ENUM('free', 'pro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'whop');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cba_jurisdiction" AS ENUM('federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cba_language" AS ENUM('en', 'fr', 'bilingual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."cba_status" AS ENUM('active', 'expired', 'under_negotiation', 'ratified_pending', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."clause_type" AS ENUM('wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tribunal_type" AS ENUM('fpslreb', 'provincial_labour_board', 'private_arbitrator', 'court_federal', 'court_provincial', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."decision_type" AS ENUM('grievance', 'unfair_practice', 'certification', 'judicial_review', 'interpretation', 'scope_bargaining', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."outcome" AS ENUM('grievance_upheld', 'grievance_denied', 'partial_success', 'dismissed', 'withdrawn', 'settled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."precedent_value" AS ENUM('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."award_status" AS ENUM('pending', 'approved', 'issued', 'rejected', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."redemption_status" AS ENUM('initiated', 'pending_payment', 'ordered', 'fulfilled', 'cancelled', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ============================================================================
-- SECTION 2: Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id" text NOT NULL PRIMARY KEY,
  "email" text,
  "membership" membership DEFAULT 'free' NOT NULL,
  "payment_provider" payment_provider DEFAULT 'whop',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "whop_user_id" text,
  "whop_membership_id" text,
  "plan_duration" text,
  "billing_cycle_start" timestamp,
  "billing_cycle_end" timestamp,
  "next_credit_renewal" timestamp,
  "usage_credits" integer DEFAULT 0,
  "used_credits" integer DEFAULT 0,
  "status" text DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_profiles" (
  "id" text NOT NULL PRIMARY KEY,
  "email" text NOT NULL,
  "token" text,
  "membership" membership DEFAULT 'pro' NOT NULL,
  "payment_provider" payment_provider DEFAULT 'whop',
  "whop_user_id" text,
  "whop_membership_id" text,
  "plan_duration" text,
  "billing_cycle_start" timestamp,
  "billing_cycle_end" timestamp,
  "next_credit_renewal" timestamp,
  "usage_credits" integer DEFAULT 0,
  "used_credits" integer DEFAULT 0,
  "claimed" boolean DEFAULT false,
  "claimed_by_user_id" text,
  "claimed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cba_contacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid NOT NULL,
  "contact_type" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "title" varchar(200),
  "organization" varchar(300),
  "email" varchar(255),
  "phone" varchar(50),
  "is_primary" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cba_version_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "change_description" text NOT NULL,
  "change_type" varchar(50) NOT NULL,
  "previous_data" jsonb,
  "new_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collective_agreements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "cba_number" varchar(100) NOT NULL,
  "title" varchar(500) NOT NULL,
  "jurisdiction" cba_jurisdiction NOT NULL,
  "language" cba_language DEFAULT 'en' NOT NULL,
  "employer_name" varchar(300) NOT NULL,
  "employer_id" varchar(100),
  "union_name" varchar(300) NOT NULL,
  "union_local" varchar(100),
  "union_id" varchar(100),
  "effective_date" timestamp with time zone NOT NULL,
  "expiry_date" timestamp with time zone NOT NULL,
  "signed_date" timestamp with time zone,
  "ratification_date" timestamp with time zone,
  "industry_sector" varchar(200) NOT NULL,
  "employee_coverage" integer,
  "bargaining_unit_description" text,
  "document_url" text,
  "document_hash" varchar(64),
  "raw_text" text,
  "structured_data" jsonb,
  "embedding" text,
  "summary_generated" text,
  "key_terms" jsonb,
  "status" cba_status DEFAULT 'active' NOT NULL,
  "is_public" boolean DEFAULT false,
  "view_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "last_modified_by" uuid,
  "version" integer DEFAULT 1 NOT NULL,
  "superseded_by" uuid,
  "precedes_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "benefit_comparisons" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid NOT NULL,
  "clause_id" uuid,
  "benefit_type" varchar(100) NOT NULL,
  "benefit_name" varchar(200) NOT NULL,
  "coverage_details" jsonb,
  "monthly_premium" numeric(10, 2),
  "annual_cost" numeric(12, 2),
  "industry_benchmark" varchar(50),
  "effective_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cba_clauses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid NOT NULL,
  "clause_number" varchar(50) NOT NULL,
  "clause_type" clause_type NOT NULL,
  "title" varchar(500) NOT NULL,
  "content" text NOT NULL,
  "content_plain_text" text,
  "page_number" integer,
  "article_number" varchar(50),
  "section_hierarchy" jsonb,
  "parent_clause_id" uuid,
  "order_index" integer DEFAULT 0 NOT NULL,
  "embedding" text,
  "confidence_score" numeric(5, 4),
  "entities" jsonb,
  "key_terms" jsonb,
  "related_clause_ids" jsonb,
  "interpretation_notes" text,
  "view_count" integer DEFAULT 0,
  "citation_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clause_comparisons" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "comparison_name" varchar(200) NOT NULL,
  "clause_type" clause_type NOT NULL,
  "organization_id" uuid NOT NULL,
  "clause_ids" jsonb NOT NULL,
  "analysis_results" jsonb,
  "industry_average" jsonb,
  "market_position" varchar(50),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wage_progressions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid NOT NULL,
  "clause_id" uuid,
  "classification" varchar(200) NOT NULL,
  "classification_code" varchar(50),
  "step" integer NOT NULL,
  "hourly_rate" numeric(10, 2),
  "annual_salary" numeric(12, 2),
  "effective_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "premiums" jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voter_eligibility" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
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
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "votes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "session_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  "voter_id" varchar(100) NOT NULL,
  "voter_hash" varchar(100),
  "cast_at" timestamp with time zone DEFAULT now(),
  "is_anonymous" boolean DEFAULT true,
  "voter_type" varchar(20) DEFAULT 'member',
  "voter_metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voting_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "session_id" uuid NOT NULL,
  "type" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "recipient_id" uuid NOT NULL,
  "priority" varchar(20) DEFAULT 'medium',
  "delivery_method" text[] DEFAULT ARRAY['push'],
  "is_read" boolean DEFAULT false,
  "sent_at" timestamp with time zone DEFAULT now(),
  "read_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voting_options" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "session_id" uuid NOT NULL,
  "text" varchar(500) NOT NULL,
  "description" text,
  "order_index" integer DEFAULT 0 NOT NULL,
  "is_default" boolean DEFAULT false,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voting_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "title" varchar(500) NOT NULL,
  "description" text,
  "type" varchar(50) NOT NULL,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "meeting_type" varchar(50) NOT NULL,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "start_time" timestamp with time zone,
  "end_time" timestamp with time zone,
  "scheduled_end_time" timestamp with time zone,
  "allow_anonymous" boolean DEFAULT true,
  "requires_quorum" boolean DEFAULT true,
  "quorum_threshold" integer DEFAULT 50,
  "total_eligible_voters" integer DEFAULT 0,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_providers" (
  "provider_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "provider_name" varchar(50) NOT NULL,
  "provider_user_id" varchar(255) NOT NULL,
  "provider_data" jsonb DEFAULT '{}'::jsonb,
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_users" (
  "tenant_user_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "role" varchar(50) DEFAULT 'member' NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean DEFAULT true,
  "is_primary" boolean DEFAULT false,
  "invited_by" uuid,
  "invited_at" timestamp with time zone,
  "joined_at" timestamp with time zone,
  "last_access_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "session_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "organization_id" uuid,
  "session_token" text NOT NULL,
  "refresh_token" text,
  "device_info" jsonb DEFAULT '{}'::jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "user_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "email" varchar(255) NOT NULL,
  "email_verified" boolean DEFAULT false,
  "email_verified_at" timestamp with time zone,
  "password_hash" text,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "display_name" varchar(200),
  "avatar_url" text,
  "phone" varchar(20),
  "phone_verified" boolean DEFAULT false,
  "phone_verified_at" timestamp with time zone,
  "timezone" varchar(50) DEFAULT 'UTC',
  "locale" varchar(10) DEFAULT 'en-US',
  "is_active" boolean DEFAULT true,
  "is_system_admin" boolean DEFAULT false,
  "last_login_at" timestamp with time zone,
  "last_login_ip" varchar(45),
  "password_changed_at" timestamp with time zone,
  "failed_login_attempts" integer DEFAULT 0,
  "account_locked_until" timestamp with time zone,
  "two_factor_enabled" boolean DEFAULT false,
  "two_factor_secret" text,
  "two_factor_backup_codes" text[],
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "database_pools" (
  "pool_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "connection_string" text NOT NULL,
  "pool_size" integer DEFAULT 10,
  "min_connections" integer DEFAULT 2,
  "max_connections" integer DEFAULT 20,
  "idle_timeout_seconds" integer DEFAULT 300,
  "is_active" boolean DEFAULT true,
  "last_health_check" timestamp with time zone,
  "health_status" varchar(20) DEFAULT 'healthy',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_configurations" (
  "config_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "category" varchar(100) NOT NULL,
  "key" varchar(100) NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "is_encrypted" boolean DEFAULT false,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_usage" (
  "usage_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "active_users" integer DEFAULT 0,
  "storage_used_gb" numeric(10, 3) DEFAULT '0',
  "api_requests" integer DEFAULT 0,
  "ai_tokens_used" integer DEFAULT 0,
  "voice_minutes_used" integer DEFAULT 0,
  "documents_processed" integer DEFAULT 0,
  "emails_sent" integer DEFAULT 0,
  "sms_messages_sent" integer DEFAULT 0,
  "usage_details" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
  "tenant_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_slug" varchar(100) NOT NULL,
  "tenant_name" varchar(255) NOT NULL,
  "subscription_tier" varchar(50) DEFAULT 'free' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "max_users" integer DEFAULT 10,
  "max_storage_gb" integer DEFAULT 5,
  "trial_ends_at" timestamp with time zone,
  "subscription_started_at" timestamp with time zone,
  "subscription_ends_at" timestamp with time zone,
  "features" jsonb DEFAULT '{}'::jsonb,
  "settings" jsonb DEFAULT '{}'::jsonb,
  "billing_email" varchar(255),
  "contact_email" varchar(255),
  "phone" varchar(20),
  "address" text,
  "timezone" varchar(50) DEFAULT 'UTC',
  "locale" varchar(10) DEFAULT 'en-US',
  "logo_url" text,
  "custom_domain" varchar(255),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "audit_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid,
  "user_id" uuid,
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" uuid,
  "old_values" jsonb,
  "new_values" jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "session_id" uuid,
  "correlation_id" uuid,
  "severity" varchar(20) DEFAULT 'info',
  "outcome" varchar(20) DEFAULT 'success',
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "failed_login_attempts" (
  "attempt_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "email" varchar(255) NOT NULL,
  "ip_address" varchar(45) NOT NULL,
  "user_agent" text,
  "failure_reason" varchar(100) NOT NULL,
  "attempted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit_events" (
  "event_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "identifier" varchar(255) NOT NULL,
  "identifier_type" varchar(20) NOT NULL,
  "endpoint" varchar(255) NOT NULL,
  "request_count" integer NOT NULL,
  "limit_exceeded" boolean DEFAULT false,
  "window_start" timestamp with time zone NOT NULL,
  "window_end" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_events" (
  "event_id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid,
  "user_id" uuid,
  "event_type" varchar(50) NOT NULL,
  "event_category" varchar(30) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "description" text NOT NULL,
  "source_ip" varchar(45),
  "user_agent" text,
  "additional_data" jsonb DEFAULT '{}'::jsonb,
  "risk_score" integer DEFAULT 0,
  "is_resolved" boolean DEFAULT false,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "resolution_notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arbitration_decisions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "case_number" varchar(100) NOT NULL,
  "case_title" varchar(500) NOT NULL,
  "tribunal" tribunal_type NOT NULL,
  "decision_type" decision_type NOT NULL,
  "decision_date" timestamp with time zone NOT NULL,
  "filing_date" timestamp with time zone,
  "hearing_date" timestamp with time zone,
  "arbitrator" varchar(200) NOT NULL,
  "panel_members" jsonb,
  "grievor" varchar(300),
  "union" varchar(300) NOT NULL,
  "employer" varchar(300) NOT NULL,
  "outcome" outcome NOT NULL,
  "remedy" jsonb,
  "key_findings" jsonb,
  "issue_types" jsonb,
  "precedent_value" precedent_value NOT NULL,
  "legal_citations" jsonb,
  "related_decisions" jsonb,
  "cba_references" jsonb,
  "full_text" text NOT NULL,
  "summary" text,
  "headnote" text,
  "sector" varchar(100),
  "jurisdiction" varchar(50),
  "language" varchar(10) DEFAULT 'en' NOT NULL,
  "citation_count" integer DEFAULT 0,
  "view_count" integer DEFAULT 0,
  "embedding" text,
  "is_public" boolean DEFAULT true,
  "access_restrictions" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "imported_from" varchar(200)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arbitrator_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "name" varchar(200) NOT NULL,
  "total_decisions" integer DEFAULT 0 NOT NULL,
  "grievor_success_rate" numeric(5, 2),
  "employer_success_rate" numeric(5, 2),
  "average_award_amount" numeric(12, 2),
  "median_award_amount" numeric(12, 2),
  "highest_award_amount" numeric(12, 2),
  "common_remedies" jsonb,
  "specializations" jsonb,
  "primary_sectors" jsonb,
  "jurisdictions" jsonb,
  "avg_decision_days" integer,
  "median_decision_days" integer,
  "decision_range_min" integer,
  "decision_range_max" integer,
  "decision_patterns" jsonb,
  "contact_info" jsonb,
  "biography" text,
  "credentials" jsonb,
  "is_active" boolean DEFAULT true,
  "last_decision_date" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bargaining_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "cba_id" uuid,
  "organization_id" uuid NOT NULL,
  "session_date" timestamp with time zone NOT NULL,
  "session_type" varchar(100) NOT NULL,
  "session_number" integer,
  "title" varchar(300) NOT NULL,
  "content" text NOT NULL,
  "attendees" jsonb,
  "related_clause_ids" jsonb,
  "related_decision_ids" jsonb,
  "tags" jsonb,
  "confidentiality_level" varchar(50) DEFAULT 'internal',
  "embedding" text,
  "key_insights" jsonb,
  "attachments" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cba_footnotes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "source_clause_id" uuid NOT NULL,
  "target_clause_id" uuid,
  "target_decision_id" uuid,
  "footnote_number" integer NOT NULL,
  "footnote_text" text NOT NULL,
  "context" text,
  "link_type" varchar(50) NOT NULL,
  "start_offset" integer,
  "end_offset" integer,
  "click_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_precedent_analysis" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "claim_id" uuid NOT NULL,
  "precedent_matches" jsonb,
  "success_probability" numeric(5, 2),
  "confidence_level" varchar(50),
  "suggested_strategy" text,
  "potential_remedies" jsonb,
  "arbitrator_tendencies" jsonb,
  "relevant_cba_clause_ids" jsonb,
  "analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "analyzed_by" varchar(50) DEFAULT 'ai_system' NOT NULL,
  "last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_campaign_recipients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "campaign_id" uuid NOT NULL,
  "user_id" text,
  "phone_number" text NOT NULL,
  "message_id" uuid,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" text,
  "phone_number" text NOT NULL,
  "direction" text NOT NULL,
  "message" text NOT NULL,
  "twilio_sid" text,
  "status" text DEFAULT 'received',
  "replied_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" text,
  "phone_number" text NOT NULL,
  "message" text NOT NULL,
  "template_id" uuid,
  "campaign_id" uuid,
  "status" text DEFAULT 'pending' NOT NULL,
  "twilio_sid" text,
  "error_code" text,
  "error_message" text,
  "segments" integer DEFAULT 1,
  "price_amount" numeric(10, 4),
  "price_currency" text DEFAULT 'USD',
  "direction" text DEFAULT 'outbound',
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_opt_outs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" text,
  "phone_number" text NOT NULL,
  "opted_out_at" timestamp with time zone DEFAULT now() NOT NULL,
  "opted_out_via" text,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_rate_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "messages_sent" integer DEFAULT 0,
  "window_start" timestamp with time zone DEFAULT now() NOT NULL,
  "window_end" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "message_template" text NOT NULL,
  "variables" text[] DEFAULT '{}',
  "category" text,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_votes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "poll_id" uuid NOT NULL,
  "user_id" text,
  "voter_email" varchar(255),
  "option_id" varchar(50) NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "voted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "polls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "question" text NOT NULL,
  "description" text,
  "options" jsonb NOT NULL,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "allow_multiple_votes" boolean DEFAULT false NOT NULL,
  "require_authentication" boolean DEFAULT true NOT NULL,
  "show_results_before_vote" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closes_at" timestamp with time zone,
  "total_votes" integer DEFAULT 0 NOT NULL,
  "unique_voters" integer DEFAULT 0 NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_answers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "response_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "answer_text" text,
  "answer_number" numeric(10, 2),
  "answer_choices" jsonb,
  "answer_other" text,
  "answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_questions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "question_text" text NOT NULL,
  "question_type" varchar(50) NOT NULL,
  "description" text,
  "order_index" integer DEFAULT 0 NOT NULL,
  "section" varchar(255),
  "required" boolean DEFAULT false NOT NULL,
  "choices" jsonb,
  "allow_other" boolean DEFAULT false NOT NULL,
  "min_choices" integer,
  "max_choices" integer,
  "rating_min" integer DEFAULT 1,
  "rating_max" integer DEFAULT 10,
  "rating_min_label" varchar(100),
  "rating_max_label" varchar(100),
  "min_length" integer,
  "max_length" integer,
  "placeholder" text,
  "show_if" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "user_id" text,
  "respondent_email" varchar(255),
  "respondent_name" varchar(255),
  "status" varchar(50) DEFAULT 'in_progress' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "time_spent_seconds" integer,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surveys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" uuid NOT NULL,
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
CREATE TABLE IF NOT EXISTS "newsletter_campaigns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "template_id" uuid,
  "name" varchar(255) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "preview_text" varchar(500),
  "from_name" varchar(255) NOT NULL,
  "from_email" varchar(255) NOT NULL,
  "reply_to_email" varchar(255),
  "html_content" text NOT NULL,
  "json_structure" jsonb,
  "status" varchar(50) DEFAULT 'draft',
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "timezone" varchar(100) DEFAULT 'UTC',
  "distribution_list_ids" uuid[] DEFAULT '{}',
  "recipient_count" integer DEFAULT 0,
  "total_sent" integer DEFAULT 0,
  "total_delivered" integer DEFAULT 0,
  "total_bounced" integer DEFAULT 0,
  "total_opened" integer DEFAULT 0,
  "total_clicked" integer DEFAULT 0,
  "total_unsubscribed" integer DEFAULT 0,
  "total_spam_reports" integer DEFAULT 0,
  "tags" varchar(100)[],
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_distribution_lists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "list_type" varchar(50) DEFAULT 'manual',
  "filter_criteria" jsonb,
  "subscriber_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_engagement" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "campaign_id" uuid NOT NULL,
  "recipient_id" uuid NOT NULL,
  "profile_id" text,
  "event_type" varchar(50) NOT NULL,
  "event_data" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "occurred_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_list_subscribers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "list_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "status" varchar(50) DEFAULT 'subscribed',
  "subscribed_at" timestamp with time zone DEFAULT now(),
  "unsubscribed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_recipients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "campaign_id" uuid NOT NULL,
  "profile_id" text,
  "email" varchar(255) NOT NULL,
  "status" varchar(50) DEFAULT 'pending',
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "bounced_at" timestamp with time zone,
  "bounce_type" varchar(50),
  "bounce_reason" text,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "category" varchar(100),
  "thumbnail_url" text,
  "html_content" text NOT NULL,
  "json_structure" jsonb,
  "variables" jsonb DEFAULT '[]'::jsonb,
  "is_system" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "usage_count" integer DEFAULT 0,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "notification_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "status" push_delivery_status DEFAULT 'pending' NOT NULL,
  "fcm_message_id" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "clicked_at" timestamp with time zone,
  "dismissed_at" timestamp with time zone,
  "error_code" text,
  "error_message" text,
  "retry_count" integer DEFAULT 0,
  "event_data" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "device_token" text NOT NULL,
  "platform" push_platform NOT NULL,
  "device_name" text,
  "device_model" text,
  "os_version" text,
  "app_version" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "timezone" text DEFAULT 'UTC',
  "last_active_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_notification_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "icon_url" text,
  "image_url" text,
  "badge_count" integer,
  "sound" text DEFAULT 'default',
  "click_action" text,
  "action_buttons" jsonb,
  "variables" jsonb,
  "priority" push_priority DEFAULT 'normal',
  "ttl" integer DEFAULT 86400,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "template_id" uuid,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "icon_url" text,
  "image_url" text,
  "badge_count" integer,
  "sound" text DEFAULT 'default',
  "click_action" text,
  "action_buttons" jsonb,
  "target_type" text NOT NULL,
  "target_criteria" jsonb,
  "device_ids" uuid[],
  "topics" text[],
  "status" push_notification_status DEFAULT 'draft' NOT NULL,
  "priority" push_priority DEFAULT 'normal',
  "scheduled_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "timezone" text DEFAULT 'UTC',
  "ttl" integer DEFAULT 86400,
  "total_targeted" integer DEFAULT 0,
  "total_sent" integer DEFAULT 0,
  "total_delivered" integer DEFAULT 0,
  "total_failed" integer DEFAULT 0,
  "total_clicked" integer DEFAULT 0,
  "total_dismissed" integer DEFAULT 0,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_analytics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "date" date NOT NULL,
  "channel" communication_channel NOT NULL,
  "messages_sent" integer DEFAULT 0,
  "messages_delivered" integer DEFAULT 0,
  "messages_failed" integer DEFAULT 0,
  "messages_opened" integer DEFAULT 0,
  "messages_clicked" integer DEFAULT 0,
  "unique_recipients" integer DEFAULT 0,
  "opt_outs" integer DEFAULT 0,
  "bounces" integer DEFAULT 0,
  "complaints" integer DEFAULT 0,
  "engagement_rate" numeric(5, 2),
  "delivery_rate" numeric(5, 2),
  "open_rate" numeric(5, 2),
  "click_rate" numeric(5, 2),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "email_enabled" boolean DEFAULT true,
  "sms_enabled" boolean DEFAULT true,
  "push_enabled" boolean DEFAULT true,
  "newsletter_enabled" boolean DEFAULT true,
  "marketing_enabled" boolean DEFAULT false,
  "grievance_updates" boolean DEFAULT true,
  "training_reminders" boolean DEFAULT true,
  "deadline_alerts" boolean DEFAULT true,
  "strike_fund_updates" boolean DEFAULT true,
  "dues_reminders" boolean DEFAULT true,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "timezone" varchar(50) DEFAULT 'UTC',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_engagement_scores" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "overall_score" integer DEFAULT 0,
  "email_score" integer DEFAULT 0,
  "sms_score" integer DEFAULT 0,
  "push_score" integer DEFAULT 0,
  "last_email_open" timestamp with time zone,
  "last_sms_reply" timestamp with time zone,
  "last_push_open" timestamp with time zone,
  "total_emails_received" integer DEFAULT 0,
  "total_emails_opened" integer DEFAULT 0,
  "total_sms_received" integer DEFAULT 0,
  "total_sms_replied" integer DEFAULT 0,
  "total_push_received" integer DEFAULT 0,
  "total_push_opened" integer DEFAULT 0,
  "calculated_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "assigned_to" uuid NOT NULL,
  "role" assignment_role NOT NULL,
  "status" assignment_status DEFAULT 'assigned',
  "assigned_by" uuid NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now(),
  "accepted_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "estimated_hours" numeric(10, 2),
  "actual_hours" numeric(10, 2),
  "assignment_reason" text,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_communications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "communication_type" varchar(100) NOT NULL,
  "direction" varchar(20) NOT NULL,
  "from_user_id" uuid,
  "from_external" varchar(255),
  "to_user_ids" uuid[],
  "to_external" varchar(255)[],
  "subject" varchar(500),
  "body" text,
  "summary" text,
  "communication_date" timestamp with time zone DEFAULT now(),
  "duration_minutes" integer,
  "attachment_ids" uuid[],
  "email_message_id" varchar(255),
  "sms_message_id" uuid,
  "calendar_event_id" uuid,
  "is_important" boolean DEFAULT false,
  "requires_followup" boolean DEFAULT false,
  "followup_date" date,
  "followup_completed" boolean DEFAULT false,
  "recorded_by" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_deadlines" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "stage_id" uuid,
  "deadline_type" varchar(100) NOT NULL,
  "deadline_date" date,
  "due_date" timestamp with time zone,
  "deadline_time" time,
  "timezone" varchar(50) DEFAULT 'America/Toronto',
  "description" text,
  "priority" varchar(20) DEFAULT 'medium',
  "status" varchar(50) DEFAULT 'pending',
  "assigned_to" text,
  "created_by" text,
  "completed_at" timestamp with time zone,
  "completed_by" text,
  "calculated_from" varchar(100),
  "contract_clause_reference" varchar(255),
  "days_from_source" integer,
  "is_met" boolean,
  "met_at" timestamp with time zone,
  "is_extended" boolean DEFAULT false,
  "extension_reason" text,
  "extended_to" date,
  "reminder_days" integer[] DEFAULT '{7,3,1}',
  "reminder_schedule" integer[] DEFAULT '{7,3,1}',
  "last_reminder_sent_at" timestamp with time zone,
  "escalate_on_miss" boolean DEFAULT true,
  "escalate_to" uuid,
  "escalated_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "document_name" varchar(255) NOT NULL,
  "document_type" varchar(100) NOT NULL,
  "file_path" text NOT NULL,
  "file_size" bigint,
  "mime_type" varchar(100),
  "version" integer DEFAULT 1,
  "parent_document_id" uuid,
  "is_latest_version" boolean DEFAULT true,
  "version_status" document_version_status DEFAULT 'draft',
  "description" text,
  "tags" text[],
  "category" varchar(100),
  "is_confidential" boolean DEFAULT false,
  "access_level" varchar(50) DEFAULT 'standard',
  "requires_signature" boolean DEFAULT false,
  "signature_status" varchar(50),
  "signed_by" uuid,
  "signed_at" timestamp with time zone,
  "signature_data" jsonb,
  "ocr_text" text,
  "indexed" boolean DEFAULT false,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now(),
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "retention_period_days" integer,
  "archived_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_settlements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "settlement_type" varchar(100) NOT NULL,
  "status" settlement_status DEFAULT 'proposed',
  "monetary_amount" numeric(15, 2),
  "currency" varchar(3) DEFAULT 'CAD',
  "payment_schedule" jsonb,
  "terms_description" text NOT NULL,
  "terms_structured" jsonb,
  "proposed_by" varchar(50) NOT NULL,
  "proposed_by_user" uuid,
  "proposed_at" timestamp with time zone DEFAULT now(),
  "responded_by" varchar(50),
  "responded_by_user" uuid,
  "responded_at" timestamp with time zone,
  "response_notes" text,
  "requires_member_approval" boolean DEFAULT true,
  "member_approved" boolean,
  "member_approved_at" timestamp with time zone,
  "requires_union_approval" boolean DEFAULT true,
  "union_approved" boolean,
  "union_approved_by" uuid,
  "union_approved_at" timestamp with time zone,
  "requires_management_approval" boolean DEFAULT true,
  "management_approved" boolean,
  "management_approved_by" uuid,
  "management_approved_at" timestamp with time zone,
  "finalized_at" timestamp with time zone,
  "finalized_by" uuid,
  "settlement_document_id" uuid,
  "signed_agreement_id" uuid,
  "set_precedent" boolean DEFAULT false,
  "precedent_description" text,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_stages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "workflow_id" uuid,
  "name" varchar(255) NOT NULL,
  "stage_type" grievance_stage_type NOT NULL,
  "description" text,
  "order_index" integer NOT NULL,
  "is_required" boolean DEFAULT true,
  "sla_days" integer,
  "auto_transition" boolean DEFAULT false,
  "require_approval" boolean DEFAULT false,
  "next_stage_id" uuid,
  "conditions" jsonb DEFAULT '[]'::jsonb,
  "entry_actions" jsonb DEFAULT '[]'::jsonb,
  "exit_actions" jsonb DEFAULT '[]'::jsonb,
  "notify_on_entry" boolean DEFAULT true,
  "notify_on_deadline" boolean DEFAULT true,
  "notification_template_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_transitions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "from_stage_id" uuid,
  "to_stage_id" uuid NOT NULL,
  "trigger_type" transition_trigger_type NOT NULL,
  "reason" text,
  "notes" text,
  "transitioned_by" uuid NOT NULL,
  "transitioned_at" timestamp with time zone DEFAULT now(),
  "requires_approval" boolean DEFAULT false,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "stage_duration_days" integer,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grievance_workflows" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "grievance_type" varchar(100),
  "contract_id" uuid,
  "is_default" boolean DEFAULT false,
  "status" grievance_workflow_status DEFAULT 'active',
  "auto_assign" boolean DEFAULT false,
  "require_approval" boolean DEFAULT false,
  "sla_days" integer,
  "stages" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_registrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "registration_date" timestamp with time zone DEFAULT now(),
  "registration_status" varchar(50) DEFAULT 'registered',
  "requires_approval" boolean DEFAULT false,
  "approved_by" uuid,
  "approved_date" date,
  "approval_notes" text,
  "attended" boolean DEFAULT false,
  "attendance_dates" jsonb,
  "attendance_hours" numeric(5, 2),
  "completed" boolean DEFAULT false,
  "completion_date" date,
  "completion_percentage" numeric(5, 2) DEFAULT '0.00',
  "pre_test_score" numeric(5, 2),
  "post_test_score" numeric(5, 2),
  "final_grade" varchar(10),
  "passed" boolean,
  "certificate_issued" boolean DEFAULT false,
  "certificate_number" varchar(100),
  "certificate_issue_date" date,
  "certificate_url" text,
  "evaluation_completed" boolean DEFAULT false,
  "evaluation_rating" numeric(3, 2),
  "evaluation_comments" text,
  "evaluation_submitted_date" date,
  "travel_required" boolean DEFAULT false,
  "travel_subsidy_requested" boolean DEFAULT false,
  "travel_subsidy_approved" boolean DEFAULT false,
  "travel_subsidy_amount" numeric(10, 2),
  "accommodation_required" boolean DEFAULT false,
  "course_fee" numeric(10, 2) DEFAULT '0.00',
  "fee_paid" boolean DEFAULT false,
  "fee_payment_date" date,
  "fee_waived" boolean DEFAULT false,
  "fee_waiver_reason" text,
  "cancellation_date" date,
  "cancellation_reason" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
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
  "lead_instructor_id" uuid,
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
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_certifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "certification_name" varchar(200) NOT NULL,
  "certification_type" varchar(100),
  "issued_by_organization" varchar(200),
  "certification_number" varchar(100),
  "issue_date" date NOT NULL,
  "expiry_date" date,
  "valid_years" integer,
  "certification_status" varchar(50) DEFAULT 'active',
  "course_id" uuid,
  "session_id" uuid,
  "registration_id" uuid,
  "renewal_required" boolean DEFAULT false,
  "renewal_date" date,
  "renewal_course_id" uuid,
  "verified" boolean DEFAULT true,
  "verification_date" date,
  "verified_by" uuid,
  "certificate_url" text,
  "digital_badge_url" text,
  "clc_registered" boolean DEFAULT false,
  "clc_registration_number" varchar(100),
  "clc_registration_date" date,
  "revoked" boolean DEFAULT false,
  "revocation_date" date,
  "revocation_reason" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_enrollments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "program_id" uuid NOT NULL,
  "enrollment_date" date NOT NULL,
  "enrollment_status" varchar(50) DEFAULT 'enrolled',
  "courses_completed" jsonb,
  "courses_completed_count" integer DEFAULT 0,
  "electives_completed_count" integer DEFAULT 0,
  "progress_percentage" numeric(5, 2) DEFAULT '0.00',
  "completed" boolean DEFAULT false,
  "completion_date" date,
  "certification_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_courses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "course_code" varchar(50) NOT NULL,
  "course_name" varchar(300) NOT NULL,
  "course_description" text,
  "course_category" varchar(50) NOT NULL,
  "delivery_method" varchar(50) NOT NULL,
  "course_difficulty" varchar(20) DEFAULT 'all_levels',
  "duration_hours" numeric(5, 2),
  "duration_days" integer,
  "has_prerequisites" boolean DEFAULT false,
  "prerequisite_courses" jsonb,
  "prerequisite_certifications" jsonb,
  "learning_objectives" text,
  "course_outline" jsonb,
  "course_materials_url" text,
  "presentation_slides_url" text,
  "workbook_url" text,
  "additional_resources" jsonb,
  "primary_instructor_name" varchar(200),
  "instructor_ids" jsonb,
  "min_enrollment" integer DEFAULT 5,
  "max_enrollment" integer DEFAULT 30,
  "provides_certification" boolean DEFAULT false,
  "certification_name" varchar(200),
  "certification_valid_years" integer,
  "clc_approved" boolean DEFAULT false,
  "clc_approval_date" date,
  "clc_course_code" varchar(50),
  "course_fee" numeric(10, 2) DEFAULT '0.00',
  "materials_fee" numeric(10, 2) DEFAULT '0.00',
  "travel_subsidy_available" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "is_mandatory" boolean DEFAULT false,
  "mandatory_for_roles" jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_programs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "program_name" varchar(200) NOT NULL,
  "program_description" text,
  "program_duration" varchar(100),
  "required_courses" jsonb,
  "elective_courses" jsonb,
  "minimum_required_courses" integer,
  "minimum_elective_courses" integer,
  "provides_certification" boolean DEFAULT false,
  "certification_name" varchar(200),
  "clc_approved" boolean DEFAULT false,
  "clc_approval_date" date,
  "is_active" boolean DEFAULT true,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_metrics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "metric_type" text NOT NULL,
  "metric_name" text NOT NULL,
  "metric_value" numeric NOT NULL,
  "metric_unit" text,
  "period_type" text NOT NULL,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "metadata" jsonb,
  "comparison_value" numeric,
  "trend" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comparative_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "analysis_name" text NOT NULL,
  "comparison_type" text NOT NULL,
  "organization_ids" jsonb,
  "metrics" jsonb NOT NULL,
  "time_range" jsonb NOT NULL,
  "results" jsonb NOT NULL,
  "benchmarks" jsonb,
  "organization_ranking" jsonb,
  "gaps" jsonb,
  "strengths" jsonb,
  "recommendations" jsonb,
  "visualization_data" jsonb,
  "is_public" boolean DEFAULT false,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insight_recommendations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
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
  "acknowledged_by" uuid,
  "acknowledged_at" timestamp,
  "dismissed_by" uuid,
  "dismissed_at" timestamp,
  "dismissal_reason" text,
  "completed_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kpi_configurations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "metric_type" text NOT NULL,
  "data_source" text NOT NULL,
  "calculation" jsonb NOT NULL,
  "visualization_type" text NOT NULL,
  "target_value" numeric,
  "warning_threshold" numeric,
  "critical_threshold" numeric,
  "alert_enabled" boolean DEFAULT false,
  "alert_recipients" jsonb,
  "refresh_interval" integer DEFAULT 3600,
  "is_active" boolean DEFAULT true,
  "display_order" integer,
  "dashboard_layout" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ml_predictions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "prediction_type" text NOT NULL,
  "model_name" text NOT NULL,
  "model_version" text NOT NULL,
  "target_date" timestamp NOT NULL,
  "predicted_value" numeric NOT NULL,
  "confidence_interval" jsonb,
  "confidence_score" numeric,
  "features" jsonb,
  "actual_value" numeric,
  "accuracy" numeric,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "validated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trend_analyses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "analysis_type" text NOT NULL,
  "data_source" text NOT NULL,
  "time_range" jsonb NOT NULL,
  "detected_trend" text,
  "trend_strength" numeric,
  "anomalies_detected" jsonb,
  "anomaly_count" integer DEFAULT 0,
  "seasonal_pattern" jsonb,
  "correlations" jsonb,
  "insights" text,
  "recommendations" jsonb,
  "statistical_tests" jsonb,
  "visualization_data" jsonb,
  "confidence" numeric,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_folders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "parent_folder_id" uuid,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tenant_id" text NOT NULL,
  "folder_id" uuid,
  "name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer,
  "file_type" text NOT NULL,
  "mime_type" text,
  "description" text,
  "tags" text[],
  "category" text,
  "content_text" text,
  "uploaded_by" text NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  "is_confidential" boolean DEFAULT false,
  "access_level" text DEFAULT 'standard',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recognition_award_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "program_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "kind" award_kind NOT NULL,
  "default_credit_amount" integer NOT NULL,
  "requires_approval" boolean DEFAULT false NOT NULL,
  "rules_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recognition_awards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "program_id" uuid NOT NULL,
  "award_type_id" uuid NOT NULL,
  "recipient_user_id" varchar(255) NOT NULL,
  "issuer_user_id" varchar(255),
  "reason" text NOT NULL,
  "status" award_status DEFAULT 'pending' NOT NULL,
  "approved_by_user_id" varchar(255),
  "approved_at" timestamp with time zone,
  "issued_at" timestamp with time zone,
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recognition_programs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "status" program_status DEFAULT 'draft' NOT NULL,
  "currency" varchar(3) DEFAULT 'CAD' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_budget_envelopes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "program_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "scope_type" budget_scope_type NOT NULL,
  "scope_ref_id" varchar(255),
  "period" budget_period NOT NULL,
  "amount_limit" integer NOT NULL,
  "amount_used" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_redemptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "program_id" uuid NOT NULL,
  "credits_spent" integer NOT NULL,
  "status" redemption_status DEFAULT 'initiated' NOT NULL,
  "provider" redemption_provider NOT NULL,
  "provider_order_id" varchar(255),
  "provider_checkout_id" varchar(255),
  "provider_payload_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_wallet_ledger" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "event_type" wallet_event_type NOT NULL,
  "amount_credits" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "source_type" wallet_source_type NOT NULL,
  "source_id" uuid,
  "memo" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_config" (
  "org_id" uuid NOT NULL PRIMARY KEY,
  "shop_domain" varchar(255) NOT NULL,
  "storefront_token_secret_ref" varchar(255) NOT NULL,
  "admin_token_secret_ref" varchar(255),
  "allowed_collections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "webhook_secret_ref" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "provider" webhook_provider NOT NULL,
  "webhook_id" varchar(255) NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "foreign_workers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone_number" text,
  "work_permit_number" text NOT NULL,
  "work_permit_expiry" timestamp NOT NULL,
  "country_of_origin" text NOT NULL,
  "employer_id" uuid NOT NULL,
  "position_title" text NOT NULL,
  "noc_code" text NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "immigration_pathway" text NOT NULL,
  "lmia_number" text,
  "gss_category" text,
  "requires_lmbp" boolean DEFAULT false,
  "lmbp_letter_generated" boolean DEFAULT false,
  "lmbp_letter_date" timestamp,
  "skills_transfer_plan" jsonb,
  "mentorship_start_date" timestamp,
  "mentorship_end_date" timestamp,
  "compliance_status" text DEFAULT 'pending' NOT NULL,
  "last_compliance_check" timestamp,
  "compliance_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gss_applications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "foreign_worker_id" uuid NOT NULL,
  "application_number" text NOT NULL,
  "submission_date" timestamp NOT NULL,
  "gss_category" text NOT NULL,
  "expected_decision_date" timestamp NOT NULL,
  "actual_decision_date" timestamp,
  "processing_days" integer,
  "met_2_week_target" boolean,
  "status" text DEFAULT 'submitted' NOT NULL,
  "decision_details" jsonb,
  "documents" jsonb,
  "employer_id" uuid NOT NULL,
  "position_details" jsonb,
  "compliance_flags" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lmbp_compliance_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "alert_type" text NOT NULL,
  "severity" text NOT NULL,
  "foreign_worker_id" uuid,
  "employer_id" uuid,
  "lmbp_letter_id" uuid,
  "gss_application_id" uuid,
  "mentorship_id" uuid,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "recommended_action" text,
  "triggered_at" timestamp DEFAULT now() NOT NULL,
  "due_date" timestamp,
  "resolved_at" timestamp,
  "status" text DEFAULT 'open' NOT NULL,
  "resolution" text,
  "resolved_by" uuid,
  "email_sent" boolean DEFAULT false,
  "email_sent_at" timestamp,
  "dashboard_notified" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lmbp_compliance_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "lmbp_letter_id" uuid NOT NULL,
  "employer_id" uuid NOT NULL,
  "reporting_period_start" timestamp NOT NULL,
  "reporting_period_end" timestamp NOT NULL,
  "submitted_to_ircc" boolean DEFAULT false,
  "submission_date" timestamp,
  "ircc_confirmation_number" text,
  "commitment_progress" jsonb NOT NULL,
  "total_foreign_workers" integer NOT NULL,
  "total_mentorships" integer NOT NULL,
  "mentorships_completed" integer NOT NULL,
  "canadian_workers_hired" integer NOT NULL,
  "training_investment" numeric(10, 2),
  "compliance_rating" text,
  "ircc_feedback" text,
  "corrective_actions_required" jsonb,
  "report_pdf_url" text,
  "supporting_documents_urls" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lmbp_letters" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "employer_id" uuid NOT NULL,
  "employer_name" text NOT NULL,
  "letter_number" text NOT NULL,
  "generated_date" timestamp NOT NULL,
  "valid_from" timestamp NOT NULL,
  "valid_until" timestamp NOT NULL,
  "commitments" jsonb NOT NULL,
  "foreign_worker_ids" jsonb NOT NULL,
  "compliance_report_due" timestamp,
  "last_compliance_report" timestamp,
  "compliance_status" text DEFAULT 'active',
  "letter_pdf_url" text,
  "letter_pdf_hash" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mentorships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "mentee_id" uuid NOT NULL,
  "mentee_name" text NOT NULL,
  "mentor_id" uuid NOT NULL,
  "mentor_name" text NOT NULL,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "actual_end_date" timestamp,
  "skills_to_transfer" jsonb NOT NULL,
  "learning_objectives" jsonb,
  "meeting_frequency" text,
  "total_meetings" integer DEFAULT 0,
  "last_meeting_date" timestamp,
  "completion_percentage" integer DEFAULT 0,
  "canadian_worker_trained" boolean DEFAULT false,
  "knowledge_transfer_documented" boolean DEFAULT false,
  "status" text DEFAULT 'active' NOT NULL,
  "status_reason" text,
  "employer_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "council_elections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "election_year" integer NOT NULL,
  "election_date" date NOT NULL,
  "positions_available" integer NOT NULL,
  "candidates" jsonb NOT NULL,
  "winners" jsonb NOT NULL,
  "total_votes" integer NOT NULL,
  "participation_rate" integer,
  "verified_by" text,
  "verification_date" date,
  "contested_results" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "golden_shares" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "share_class" text DEFAULT 'B' NOT NULL,
  "certificate_number" text NOT NULL,
  "issue_date" date NOT NULL,
  "holder_type" text DEFAULT 'council' NOT NULL,
  "council_members" jsonb NOT NULL,
  "voting_power_reserved_matters" integer DEFAULT 51 NOT NULL,
  "voting_power_ordinary_matters" integer DEFAULT 1 NOT NULL,
  "redemption_value" integer DEFAULT 1 NOT NULL,
  "dividend_rights" boolean DEFAULT false NOT NULL,
  "sunset_clause_active" boolean DEFAULT true NOT NULL,
  "sunset_clause_duration" integer DEFAULT 5 NOT NULL,
  "consecutive_compliance_years" integer DEFAULT 0 NOT NULL,
  "sunset_triggered_date" date,
  "conversion_date" date,
  "status" text DEFAULT 'active' NOT NULL,
  "transferable" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governance_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "event_type" text NOT NULL,
  "event_date" timestamp NOT NULL,
  "golden_share_id" uuid,
  "reserved_matter_vote_id" uuid,
  "mission_audit_id" uuid,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "impact" text,
  "impact_description" text,
  "stakeholders" jsonb,
  "notifications_sent" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mission_audits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "audit_year" integer NOT NULL,
  "audit_period_start" date NOT NULL,
  "audit_period_end" date NOT NULL,
  "auditor_firm" text NOT NULL,
  "auditor_name" text NOT NULL,
  "auditor_certification" text,
  "audit_date" date NOT NULL,
  "union_revenue_percent" integer NOT NULL,
  "member_satisfaction_percent" integer NOT NULL,
  "data_violations" integer DEFAULT 0 NOT NULL,
  "union_revenue_threshold" integer DEFAULT 90 NOT NULL,
  "member_satisfaction_threshold" integer DEFAULT 80 NOT NULL,
  "data_violations_threshold" integer DEFAULT 0 NOT NULL,
  "union_revenue_pass" boolean NOT NULL,
  "member_satisfaction_pass" boolean NOT NULL,
  "data_violations_pass" boolean NOT NULL,
  "overall_pass" boolean NOT NULL,
  "total_revenue" integer,
  "union_revenue" integer,
  "member_survey_sample_size" integer,
  "member_survey_responses" integer,
  "data_violation_details" jsonb,
  "auditor_opinion" text NOT NULL,
  "auditor_notes" text,
  "corrective_actions" jsonb,
  "impacts_consecutive_compliance" boolean NOT NULL,
  "consecutive_years_after_audit" integer,
  "audit_report_pdf_url" text,
  "supporting_documents_urls" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reserved_matter_votes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "matter_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "proposed_by" uuid NOT NULL,
  "proposed_date" timestamp NOT NULL,
  "voting_deadline" timestamp NOT NULL,
  "matter_details" jsonb NOT NULL,
  "class_a_votes_for" integer DEFAULT 0,
  "class_a_votes_against" integer DEFAULT 0,
  "class_a_abstain" integer DEFAULT 0,
  "class_a_total_votes" integer NOT NULL,
  "class_a_percent_for" integer DEFAULT 0,
  "class_b_vote" text,
  "class_b_vote_date" timestamp,
  "class_b_vote_rationale" text,
  "class_b_council_members_voting" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "final_decision" text,
  "decision_date" timestamp,
  "implemented" boolean DEFAULT false,
  "implementation_date" timestamp,
  "implementation_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_subject_access_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "request_type" varchar(50) NOT NULL,
  "province" varchar(2) NOT NULL,
  "request_description" text,
  "requested_data_types" jsonb,
  "identity_verified" boolean DEFAULT false NOT NULL,
  "verification_method" varchar(50),
  "verified_at" timestamp,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "assigned_to" uuid,
  "response_deadline" timestamp NOT NULL,
  "responded_at" timestamp,
  "deadline_met" boolean DEFAULT false NOT NULL,
  "denial_reason" text,
  "denial_legal_basis" text,
  "response_method" varchar(50),
  "response_delivered_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_breaches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "breach_type" varchar(50) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "affected_province" varchar(2),
  "affected_user_count" varchar(20) DEFAULT '0' NOT NULL,
  "data_types" jsonb NOT NULL,
  "breach_description" text NOT NULL,
  "discovered_at" timestamp NOT NULL,
  "contained_at" timestamp,
  "user_notification_required" boolean DEFAULT true NOT NULL,
  "regulator_notification_required" boolean DEFAULT true NOT NULL,
  "users_notified_at" timestamp,
  "regulator_notified_at" timestamp,
  "notification_deadline" timestamp NOT NULL,
  "deadline_met" boolean DEFAULT false NOT NULL,
  "mitigation_steps" jsonb,
  "mitigation_completed_at" timestamp,
  "incident_report" text,
  "reported_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provincial_consent" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "province" varchar(2) NOT NULL,
  "consent_type" varchar(50) NOT NULL,
  "consent_given" boolean NOT NULL,
  "consent_method" varchar(50) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "consent_text" text NOT NULL,
  "consent_language" varchar(2) DEFAULT 'en' NOT NULL,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "band_council_consent" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "band_council_id" uuid NOT NULL,
  "consent_type" varchar(50) NOT NULL,
  "consent_given" boolean NOT NULL,
  "bcr_number" varchar(50),
  "bcr_date" timestamp,
  "bcr_document" text,
  "purpose_of_collection" text NOT NULL,
  "data_categories" jsonb NOT NULL,
  "intended_use" text NOT NULL,
  "expires_at" timestamp,
  "restricted_to_members" boolean DEFAULT true NOT NULL,
  "anonymization_required" boolean DEFAULT false NOT NULL,
  "revoked_at" timestamp,
  "revocation_reason" text,
  "approved_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "band_councils" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "band_name" text NOT NULL,
  "band_number" varchar(10) NOT NULL,
  "province" varchar(2) NOT NULL,
  "region" varchar(50) NOT NULL,
  "chief_name" text,
  "admin_contact_name" text,
  "admin_contact_email" varchar(255),
  "admin_contact_phone" varchar(20),
  "on_reserve_storage_enabled" boolean DEFAULT false NOT NULL,
  "storage_location" text,
  "data_residency_required" boolean DEFAULT true NOT NULL,
  "third_party_access_allowed" boolean DEFAULT false NOT NULL,
  "aggregation_allowed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indigenous_data_access_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "accessed_by" uuid NOT NULL,
  "band_council_id" uuid,
  "access_type" varchar(50) NOT NULL,
  "access_purpose" text NOT NULL,
  "data_categories" jsonb NOT NULL,
  "authorized_by" varchar(50) NOT NULL,
  "authorization_reference" text,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indigenous_data_sharing_agreements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "band_council_id" uuid NOT NULL,
  "partner_name" text NOT NULL,
  "partner_type" varchar(50) NOT NULL,
  "agreement_title" text NOT NULL,
  "agreement_description" text NOT NULL,
  "agreement_document" text,
  "signed_date" timestamp,
  "data_sharing_scope" jsonb NOT NULL,
  "purpose_limitation" text NOT NULL,
  "anonymization_required" boolean DEFAULT true NOT NULL,
  "valid_from" timestamp NOT NULL,
  "valid_until" timestamp,
  "auto_renewal" boolean DEFAULT false NOT NULL,
  "approved_by" uuid NOT NULL,
  "bcr_number" varchar(50),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "terminated_at" timestamp,
  "termination_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "indigenous_member_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "indigenous_status" varchar(50) NOT NULL,
  "band_council_id" uuid,
  "treaty_number" varchar(20),
  "cultural_data_sensitivity" varchar(20) DEFAULT 'standard' NOT NULL,
  "traditional_knowledge_holder" boolean DEFAULT false NOT NULL,
  "elder_status" boolean DEFAULT false NOT NULL,
  "data_control_preference" varchar(50) DEFAULT 'band_council' NOT NULL,
  "allow_aggregation" boolean DEFAULT false NOT NULL,
  "allow_third_party_access" boolean DEFAULT false NOT NULL,
  "on_reserve_data_only" boolean DEFAULT false NOT NULL,
  "preferred_storage_location" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "traditional_knowledge_registry" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "band_council_id" uuid NOT NULL,
  "knowledge_type" varchar(50) NOT NULL,
  "knowledge_title" text NOT NULL,
  "knowledge_description" text,
  "sensitivity_level" varchar(20) NOT NULL,
  "gender_restricted" boolean DEFAULT false NOT NULL,
  "age_restricted" boolean DEFAULT false NOT NULL,
  "primary_keeper_user_id" uuid,
  "secondary_keepers" jsonb,
  "public_access" boolean DEFAULT false NOT NULL,
  "member_only_access" boolean DEFAULT true NOT NULL,
  "elder_approval_required" boolean DEFAULT false NOT NULL,
  "documentation_url" text,
  "video_url" text,
  "audio_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rl1_tax_slips" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "tax_year" varchar(4) NOT NULL,
  "payer_name" text NOT NULL,
  "payer_quebec_enterprise_number" varchar(10) NOT NULL,
  "payer_address" text NOT NULL,
  "payer_city" varchar(100) NOT NULL,
  "payer_postal_code" varchar(10) NOT NULL,
  "recipient_name" text NOT NULL,
  "recipient_sin" varchar(11),
  "recipient_address" text NOT NULL,
  "recipient_city" varchar(100) NOT NULL,
  "recipient_postal_code" varchar(10) NOT NULL,
  "box_o_other_income" numeric(10, 2) NOT NULL,
  "box_e_quebec_income_tax_deducted" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL,
  "generated_by" uuid NOT NULL,
  "filed_with_revenu_quebec" boolean DEFAULT false NOT NULL,
  "revenu_quebec_filing_date" timestamp,
  "revenu_quebec_confirmation_number" varchar(50),
  "delivered_to_member" boolean DEFAULT false NOT NULL,
  "delivery_method" varchar(50),
  "delivered_at" timestamp,
  "pdf_url" text,
  "xml_url" text,
  "is_amendment" boolean DEFAULT false NOT NULL,
  "original_slip_id" uuid,
  "amendment_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strike_fund_disbursements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "strike_id" uuid,
  "strike_name" text,
  "strike_start_date" timestamp,
  "strike_end_date" timestamp,
  "payment_date" timestamp NOT NULL,
  "payment_amount" numeric(10, 2) NOT NULL,
  "payment_method" varchar(50) NOT NULL,
  "payment_reference" varchar(100),
  "tax_year" varchar(4) NOT NULL,
  "tax_month" varchar(2) NOT NULL,
  "week_number" varchar(10) NOT NULL,
  "weekly_total" numeric(10, 2) NOT NULL,
  "exceeds_threshold" boolean DEFAULT false NOT NULL,
  "requires_tax_slip" boolean DEFAULT false NOT NULL,
  "t4a_generated" boolean DEFAULT false NOT NULL,
  "t4a_generated_at" timestamp,
  "rl1_generated" boolean DEFAULT false NOT NULL,
  "rl1_generated_at" timestamp,
  "province" varchar(2) NOT NULL,
  "is_quebec_resident" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "t4a_tax_slips" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "tax_year" varchar(4) NOT NULL,
  "payer_name" text NOT NULL,
  "payer_business_number" varchar(15) NOT NULL,
  "payer_address" text NOT NULL,
  "payer_city" varchar(100) NOT NULL,
  "payer_province" varchar(2) NOT NULL,
  "payer_postal_code" varchar(10) NOT NULL,
  "recipient_name" text NOT NULL,
  "recipient_sin" varchar(11),
  "recipient_address" text NOT NULL,
  "recipient_city" varchar(100) NOT NULL,
  "recipient_province" varchar(2) NOT NULL,
  "recipient_postal_code" varchar(10) NOT NULL,
  "box_028_other_income" numeric(10, 2) NOT NULL,
  "box_022_income_tax_deducted" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "generated_at" timestamp DEFAULT now() NOT NULL,
  "generated_by" uuid NOT NULL,
  "filed_with_cra" boolean DEFAULT false NOT NULL,
  "cra_filing_date" timestamp,
  "cra_confirmation_number" varchar(50),
  "delivered_to_member" boolean DEFAULT false NOT NULL,
  "delivery_method" varchar(50),
  "delivered_at" timestamp,
  "pdf_url" text,
  "xml_url" text,
  "is_amendment" boolean DEFAULT false NOT NULL,
  "original_slip_id" uuid,
  "amendment_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_year_end_processing" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "tax_year" varchar(4) NOT NULL,
  "processing_started_at" timestamp,
  "processing_completed_at" timestamp,
  "t4a_slips_generated" varchar(10) DEFAULT '0' NOT NULL,
  "t4a_total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "t4a_filing_deadline" timestamp NOT NULL,
  "t4a_filed_at" timestamp,
  "t4a_filing_confirmed" boolean DEFAULT false NOT NULL,
  "rl1_slips_generated" varchar(10) DEFAULT '0' NOT NULL,
  "rl1_total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "rl1_filing_deadline" timestamp NOT NULL,
  "rl1_filed_at" timestamp,
  "rl1_filing_confirmed" boolean DEFAULT false NOT NULL,
  "member_delivery_started_at" timestamp,
  "member_delivery_completed_at" timestamp,
  "slips_delivered_to_members" varchar(10) DEFAULT '0' NOT NULL,
  "compliance_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "deadline_missed" boolean DEFAULT false NOT NULL,
  "processed_by" uuid,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_threshold_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "tax_year" varchar(4) NOT NULL,
  "week_number" varchar(10) NOT NULL,
  "week_start_date" timestamp NOT NULL,
  "week_end_date" timestamp NOT NULL,
  "payment_count" varchar(10) DEFAULT '0' NOT NULL,
  "weekly_total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "exceeds_threshold" boolean DEFAULT false NOT NULL,
  "threshold_amount" numeric(10, 2) DEFAULT '500.00' NOT NULL,
  "requires_t4a" boolean DEFAULT false NOT NULL,
  "requires_rl1" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "break_glass_activations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "break_glass_system_id" uuid NOT NULL,
  "activation_type" varchar(20) NOT NULL,
  "activation_reason" text NOT NULL,
  "emergency_level" varchar(20) NOT NULL,
  "activated_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "recovery_duration" varchar(50),
  "required_signatures" integer DEFAULT 3 NOT NULL,
  "signatures_received" integer DEFAULT 0 NOT NULL,
  "signature_1_user_id" uuid,
  "signature_1_timestamp" timestamp,
  "signature_1_ip_address" varchar(45),
  "signature_2_user_id" uuid,
  "signature_2_timestamp" timestamp,
  "signature_2_ip_address" varchar(45),
  "signature_3_user_id" uuid,
  "signature_3_timestamp" timestamp,
  "signature_3_ip_address" varchar(45),
  "signature_4_user_id" uuid,
  "signature_4_timestamp" timestamp,
  "signature_4_ip_address" varchar(45),
  "signature_5_user_id" uuid,
  "signature_5_timestamp" timestamp,
  "signature_5_ip_address" varchar(45),
  "authorization_complete" boolean DEFAULT false NOT NULL,
  "authorization_completed_at" timestamp,
  "recovery_actions_log" jsonb,
  "swiss_cold_storage_accessed" boolean DEFAULT false NOT NULL,
  "cold_storage_accessed_at" timestamp,
  "incident_report_url" text,
  "lessons_learned_url" text,
  "system_updates_required" jsonb,
  "activated_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "break_glass_system" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "scenario_type" varchar(50) NOT NULL,
  "scenario_description" text NOT NULL,
  "recovery_plan_document" text,
  "estimated_recovery_time" varchar(50) NOT NULL,
  "shamir_threshold" integer DEFAULT 3 NOT NULL,
  "shamir_total_shares" integer DEFAULT 5 NOT NULL,
  "key_holder_id_1" uuid,
  "key_holder_id_2" uuid,
  "key_holder_id_3" uuid,
  "key_holder_id_4" uuid,
  "key_holder_id_5" uuid,
  "emergency_contact_1_name" text,
  "emergency_contact_1_phone" varchar(20),
  "emergency_contact_1_email" varchar(255),
  "emergency_contact_2_name" text,
  "emergency_contact_2_phone" varchar(20),
  "emergency_contact_2_email" varchar(255),
  "last_tested_at" timestamp,
  "testing_frequency" varchar(50) DEFAULT 'quarterly' NOT NULL,
  "next_test_due" timestamp NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disaster_recovery_drills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "drill_name" text NOT NULL,
  "drill_type" varchar(50) NOT NULL,
  "scenario_type" varchar(50) NOT NULL,
  "scheduled_date" timestamp NOT NULL,
  "actual_start_time" timestamp,
  "actual_end_time" timestamp,
  "duration" varchar(50),
  "participants" jsonb NOT NULL,
  "participant_count" integer NOT NULL,
  "objectives" jsonb NOT NULL,
  "objectives_met" jsonb,
  "status" varchar(20) DEFAULT 'scheduled' NOT NULL,
  "overall_score" integer,
  "target_recovery_time" varchar(50) NOT NULL,
  "actual_recovery_time" varchar(50),
  "recovery_time_objective_met" boolean DEFAULT false NOT NULL,
  "issues_identified" jsonb,
  "remediation_actions" jsonb,
  "remediation_deadline" timestamp,
  "drill_report_url" text,
  "video_recording_url" text,
  "conducted_by" uuid NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "key_holder_registry" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "role" varchar(50) NOT NULL,
  "key_holder_number" integer NOT NULL,
  "shamir_share_encrypted" text NOT NULL,
  "shamir_share_fingerprint" varchar(64) NOT NULL,
  "key_issued_at" timestamp NOT NULL,
  "key_expires_at" timestamp,
  "key_rotation_due" timestamp NOT NULL,
  "break_glass_training_completed" boolean DEFAULT false NOT NULL,
  "training_completed_at" timestamp,
  "training_expires_at" timestamp,
  "emergency_phone" varchar(20) NOT NULL,
  "emergency_email" varchar(255) NOT NULL,
  "backup_contact_name" text,
  "backup_contact_phone" varchar(20),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "last_verified_at" timestamp,
  "next_verification_due" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recovery_time_objectives" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "system_component" varchar(100) NOT NULL,
  "component_description" text,
  "rto_hours" integer NOT NULL,
  "rpo_hours" integer NOT NULL,
  "depends_on" jsonb,
  "criticality_level" varchar(20) NOT NULL,
  "last_tested_at" timestamp,
  "last_test_result" varchar(20),
  "actual_recovery_time" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "swiss_cold_storage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "vault_provider" varchar(100) NOT NULL,
  "vault_location" text NOT NULL,
  "vault_account_number" varchar(100),
  "storage_type" varchar(50) NOT NULL,
  "data_category" varchar(50) NOT NULL,
  "last_updated" timestamp NOT NULL,
  "encryption_algorithm" varchar(50) DEFAULT 'AES-256-GCM' NOT NULL,
  "encrypted_by" uuid NOT NULL,
  "access_requires_multi_sig" boolean DEFAULT true NOT NULL,
  "minimum_signatures" integer DEFAULT 3 NOT NULL,
  "total_key_holders" integer DEFAULT 5 NOT NULL,
  "last_accessed_at" timestamp,
  "last_accessed_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geofences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "geofence_type" varchar(50) NOT NULL,
  "center_latitude" numeric(10, 8) NOT NULL,
  "center_longitude" numeric(11, 8) NOT NULL,
  "radius_meters" numeric(10, 2) NOT NULL,
  "strike_id" uuid,
  "union_local_id" uuid,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "active_from" timestamp,
  "active_to" timestamp,
  "notify_on_entry" boolean DEFAULT false NOT NULL,
  "notify_on_exit" boolean DEFAULT false NOT NULL,
  "requires_explicit_consent" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_deletion_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "deletion_type" varchar(50) NOT NULL,
  "deletion_reason" text,
  "record_count" varchar(20) NOT NULL,
  "oldest_record_date" timestamp,
  "newest_record_date" timestamp,
  "initiated_by" uuid,
  "initiator_role" varchar(50),
  "deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_tracking_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "action_type" varchar(50) NOT NULL,
  "action_description" text,
  "performed_by" uuid,
  "performed_by_role" varchar(50),
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_tracking_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "location_tracking_enabled" boolean DEFAULT true NOT NULL,
  "max_retention_hours" varchar(10) DEFAULT '24' NOT NULL,
  "background_tracking_allowed" boolean DEFAULT false NOT NULL,
  "background_tracking_reason" text,
  "explicit_opt_in_required" boolean DEFAULT true NOT NULL,
  "consent_renewal_months" varchar(10) DEFAULT '6' NOT NULL,
  "auto_deletion_enabled" boolean DEFAULT true NOT NULL,
  "auto_deletion_schedule" varchar(50) DEFAULT 'hourly' NOT NULL,
  "compliance_review_required" boolean DEFAULT true NOT NULL,
  "last_compliance_review" timestamp,
  "next_compliance_review_due" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_of_canada_rates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "rate_date" timestamp NOT NULL,
  "currency" varchar(3) NOT NULL,
  "noon_rate" numeric(15, 8) NOT NULL,
  "buy_rate" numeric(15, 8),
  "sell_rate" numeric(15, 8),
  "source" varchar(50) DEFAULT 'bank_of_canada_api' NOT NULL,
  "data_quality" varchar(20) DEFAULT 'official' NOT NULL,
  "imported_at" timestamp DEFAULT now() NOT NULL,
  "imported_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "currency_enforcement_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "action_type" varchar(50) NOT NULL,
  "action_description" text NOT NULL,
  "transaction_id" uuid,
  "affected_currency" varchar(3),
  "affected_amount" numeric(15, 2),
  "performed_by" uuid NOT NULL,
  "performed_by_role" varchar(50),
  "compliance_impact" varchar(20),
  "metadata" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "currency_enforcement_policy" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "enforcement_enabled" boolean DEFAULT true NOT NULL,
  "mandatory_currency" varchar(3) DEFAULT 'CAD' NOT NULL,
  "allow_foreign_currency" boolean DEFAULT false NOT NULL,
  "foreign_currency_reason" text,
  "fx_rate_source" varchar(50) DEFAULT 'bank_of_canada' NOT NULL,
  "fx_rate_update_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
  "t106_filing_required" boolean DEFAULT true NOT NULL,
  "t106_threshold_cad" numeric(15, 2) DEFAULT '1000000.00' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "currency_enforcement_violations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "violation_type" varchar(50) NOT NULL,
  "violation_description" text NOT NULL,
  "transaction_id" uuid,
  "attempted_currency" varchar(3),
  "attempted_amount" numeric(15, 2),
  "attempted_by" uuid NOT NULL,
  "attempted_at" timestamp DEFAULT now() NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "resolution" text,
  "resolved_by" uuid,
  "resolved_at" timestamp,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fx_rate_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "action_type" varchar(50) NOT NULL,
  "action_description" text,
  "currency" varchar(3),
  "rate_date" timestamp,
  "old_rate" numeric(15, 8),
  "new_rate" numeric(15, 8),
  "performed_by" uuid,
  "performed_by_role" varchar(50),
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "t106_filing_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "fiscal_year" varchar(4) NOT NULL,
  "total_foreign_transactions" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "total_cad_equivalent" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  "t106_threshold_exceeded" boolean DEFAULT false NOT NULL,
  "t106_filing_required" boolean DEFAULT false NOT NULL,
  "reportable_transaction_count" varchar(10) DEFAULT '0' NOT NULL,
  "reportable_transaction_ids" jsonb,
  "filing_status" varchar(20) DEFAULT 'not_required' NOT NULL,
  "filing_due_date" timestamp,
  "filed_date" timestamp,
  "confirmation_number" varchar(50),
  "prepared_by" uuid,
  "reviewed_by" uuid,
  "filed_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_currency_conversions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "transaction_id" uuid NOT NULL,
  "transaction_type" varchar(50) NOT NULL,
  "original_currency" varchar(3) NOT NULL,
  "original_amount" numeric(15, 2) NOT NULL,
  "cad_amount" numeric(15, 2) NOT NULL,
  "fx_rate_used" numeric(15, 8) NOT NULL,
  "fx_rate_date" timestamp NOT NULL,
  "fx_rate_source" varchar(50) DEFAULT 'bank_of_canada' NOT NULL,
  "exception_approved" boolean DEFAULT false NOT NULL,
  "exception_reason" text,
  "approved_by" uuid,
  "approved_at" timestamp,
  "conversion_method" varchar(50) DEFAULT 'noon_rate' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_pricing_documentation" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "transaction_id" uuid NOT NULL,
  "transaction_type" varchar(50) NOT NULL,
  "from_party" uuid NOT NULL,
  "to_party" uuid NOT NULL,
  "arms_length_required" boolean DEFAULT true NOT NULL,
  "arms_length_confirmed" boolean DEFAULT false NOT NULL,
  "arms_length_method" varchar(50),
  "cad_amount" numeric(15, 2) NOT NULL,
  "pricing_justification" text NOT NULL,
  "comparable_transactions" jsonb,
  "supporting_documents" jsonb,
  "documented_by" uuid NOT NULL,
  "documented_at" timestamp DEFAULT now() NOT NULL,
  "review_required" boolean DEFAULT true NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp,
  "review_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arms_length_verification" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "transaction_id" uuid NOT NULL,
  "transaction_type" varchar(50) NOT NULL,
  "transaction_amount" numeric(15, 2) NOT NULL,
  "from_party" uuid NOT NULL,
  "to_party" uuid NOT NULL,
  "relationship_exists" boolean DEFAULT false NOT NULL,
  "relationship_type" varchar(50),
  "relationship_description" text,
  "arms_length_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "arms_length_justification" text,
  "verification_method" varchar(50),
  "comparable_transactions" jsonb,
  "reviewed_by" uuid,
  "reviewed_at" timestamp,
  "review_decision" varchar(20),
  "review_notes" text,
  "compliant" boolean DEFAULT false NOT NULL,
  "compliance_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blind_trust_registry" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(50) NOT NULL,
  "trust_status" varchar(20) DEFAULT 'required' NOT NULL,
  "trust_established_date" timestamp,
  "trustee_name" text,
  "trustee_contact" text,
  "trustee_relationship" varchar(50),
  "trust_type" varchar(50),
  "trust_document" text,
  "trust_account_number" varchar(100),
  "assets_transferred" jsonb,
  "estimated_value" numeric(15, 2),
  "verified_by" uuid,
  "verified_at" timestamp,
  "verification_notes" text,
  "last_review_date" timestamp,
  "next_review_due" timestamp,
  "compliant" boolean DEFAULT false NOT NULL,
  "compliance_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "action_type" varchar(50) NOT NULL,
  "action_description" text NOT NULL,
  "subject_user_id" uuid,
  "related_disclosure_id" uuid,
  "related_transaction_id" uuid,
  "performed_by" uuid NOT NULL,
  "performed_by_role" varchar(50),
  "compliance_impact" varchar(20),
  "metadata" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_disclosures" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(50) NOT NULL,
  "disclosure_type" varchar(50) NOT NULL,
  "disclosure_year" varchar(4),
  "conflict_type" varchar(50) NOT NULL,
  "conflict_description" text NOT NULL,
  "related_parties" jsonb,
  "related_transaction_ids" jsonb,
  "financial_interest_amount" numeric(15, 2),
  "ownership_percentage" numeric(5, 2),
  "mitigation_plan" text,
  "recusal_required" boolean DEFAULT false NOT NULL,
  "recusal_documented" boolean DEFAULT false NOT NULL,
  "review_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "review_notes" text,
  "reviewed_by" jsonb,
  "review_completed_at" timestamp,
  "disclosure_deadline" timestamp,
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "overdue" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_of_interest_policy" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "policy_enabled" boolean DEFAULT true NOT NULL,
  "blind_trust_required" boolean DEFAULT true NOT NULL,
  "annual_disclosure_required" boolean DEFAULT true NOT NULL,
  "disclosure_deadline" varchar(10) DEFAULT '01-31' NOT NULL,
  "significant_interest_threshold" numeric(15, 2) DEFAULT '5000.00' NOT NULL,
  "arms_length_verification_required" boolean DEFAULT true NOT NULL,
  "covered_roles" jsonb DEFAULT '["founder","president","vice_president","treasurer","secretary","executive_director","board_member"]'::jsonb NOT NULL,
  "review_committee_required" boolean DEFAULT true NOT NULL,
  "minimum_reviewers" varchar(2) DEFAULT '2' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_review_committee" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(50) NOT NULL,
  "committee_role" varchar(50) NOT NULL,
  "appointed_by" uuid,
  "appointed_at" timestamp DEFAULT now() NOT NULL,
  "term_start_date" timestamp NOT NULL,
  "term_end_date" timestamp,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conflict_training" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(50) NOT NULL,
  "training_type" varchar(50) NOT NULL,
  "training_date" timestamp NOT NULL,
  "training_provider" text,
  "completion_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "completed_at" timestamp,
  "certificate_url" text,
  "next_training_due" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recusal_tracking" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(50) NOT NULL,
  "recusal_type" varchar(50) NOT NULL,
  "recusal_reason" text NOT NULL,
  "related_matter" text,
  "related_meeting_id" uuid,
  "related_vote_id" uuid,
  "related_transaction_id" uuid,
  "recusal_documented" boolean DEFAULT false NOT NULL,
  "documentation_url" text,
  "documented_by" uuid,
  "documented_at" timestamp,
  "recusal_start_date" timestamp NOT NULL,
  "recusal_end_date" timestamp,
  "verified_by" uuid,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cpi_adjusted_pricing" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "item_id" uuid NOT NULL,
  "item_description" text NOT NULL,
  "contract_id" uuid,
  "original_price" numeric(15, 2) NOT NULL,
  "original_price_date" timestamp NOT NULL,
  "original_cpi" numeric(10, 4) NOT NULL,
  "adjusted_price" numeric(15, 2) NOT NULL,
  "adjustment_date" timestamp NOT NULL,
  "current_cpi" numeric(10, 4) NOT NULL,
  "cpi_change_percentage" numeric(6, 4) NOT NULL,
  "adjustment_amount" numeric(15, 2) NOT NULL,
  "adjustment_approved" boolean DEFAULT false NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cpi_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "period_year" varchar(4) NOT NULL,
  "period_month" varchar(2) NOT NULL,
  "period_date" timestamp NOT NULL,
  "cpi_value" numeric(10, 4) NOT NULL,
  "cpi_change" numeric(6, 4),
  "cpi_year_over_year" numeric(6, 4),
  "base_year" varchar(4) DEFAULT '2002' NOT NULL,
  "source" varchar(50) DEFAULT 'statistics_canada' NOT NULL,
  "data_quality" varchar(20) DEFAULT 'official' NOT NULL,
  "imported_at" timestamp DEFAULT now() NOT NULL,
  "imported_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fmv_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "action_type" varchar(50) NOT NULL,
  "action_description" text NOT NULL,
  "procurement_request_id" uuid,
  "bid_id" uuid,
  "appraisal_id" uuid,
  "performed_by" uuid NOT NULL,
  "performed_by_role" varchar(50),
  "compliance_impact" varchar(20),
  "metadata" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fmv_benchmarks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "item_category" varchar(50) NOT NULL,
  "item_description" text NOT NULL,
  "item_specifications" jsonb,
  "fmv_low" numeric(15, 2) NOT NULL,
  "fmv_high" numeric(15, 2) NOT NULL,
  "fmv_median" numeric(15, 2) NOT NULL,
  "region" varchar(50) NOT NULL,
  "city" varchar(100),
  "effective_from" timestamp NOT NULL,
  "effective_to" timestamp,
  "data_sources" jsonb,
  "comparable_transactions" jsonb,
  "cpi_adjusted" boolean DEFAULT false NOT NULL,
  "original_fmv" numeric(15, 2),
  "cpi_adjustment_factor" numeric(10, 6),
  "reviewed_by" uuid,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fmv_policy" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "policy_enabled" boolean DEFAULT true NOT NULL,
  "fmv_verification_required" boolean DEFAULT true NOT NULL,
  "competitive_bidding_threshold" numeric(15, 2) DEFAULT '10000.00' NOT NULL,
  "minimum_bids_required" varchar(2) DEFAULT '3' NOT NULL,
  "cpi_escalator_enabled" boolean DEFAULT true NOT NULL,
  "cpi_update_frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
  "cpi_base_year" varchar(4) DEFAULT '2002' NOT NULL,
  "appraisal_required" boolean DEFAULT true NOT NULL,
  "appraisal_threshold" numeric(15, 2) DEFAULT '50000.00' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fmv_violations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "violation_type" varchar(50) NOT NULL,
  "violation_description" text NOT NULL,
  "procurement_request_id" uuid,
  "transaction_id" uuid,
  "severity" varchar(20) DEFAULT 'medium' NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "resolution" text,
  "resolved_by" uuid,
  "resolved_at" timestamp,
  "detected_by" uuid,
  "detected_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "independent_appraisals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "item_type" varchar(50) NOT NULL,
  "item_description" text NOT NULL,
  "item_specifications" jsonb,
  "procurement_request_id" uuid,
  "appraiser_name" text NOT NULL,
  "appraiser_company" text,
  "appraiser_credentials" text,
  "appraiser_contact" text,
  "appraised_value" numeric(15, 2) NOT NULL,
  "appraisal_method" varchar(50) NOT NULL,
  "appraisal_date" timestamp NOT NULL,
  "appraisal_valid_until" timestamp,
  "appraisal_report" text,
  "appraisal_notes" text,
  "reviewed_by" uuid,
  "reviewed_at" timestamp,
  "review_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "procurement_bids" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "procurement_request_id" uuid NOT NULL,
  "bidder_name" text NOT NULL,
  "bidder_contact" text NOT NULL,
  "bidder_email" varchar(255),
  "bidder_phone" varchar(20),
  "bid_amount" numeric(15, 2) NOT NULL,
  "bid_documents" jsonb,
  "bid_notes" text,
  "bid_valid_until" timestamp,
  "fmv_benchmark_id" uuid,
  "within_fmv_range" boolean DEFAULT false NOT NULL,
  "fmv_variance_percentage" numeric(6, 2),
  "evaluation_score" numeric(5, 2),
  "evaluation_notes" text,
  "evaluated_by" uuid,
  "evaluated_at" timestamp,
  "bid_status" varchar(20) DEFAULT 'submitted' NOT NULL,
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "procurement_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "request_number" varchar(50) NOT NULL,
  "request_title" text NOT NULL,
  "request_description" text NOT NULL,
  "requested_by" uuid NOT NULL,
  "requested_by_department" varchar(100),
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "estimated_value" numeric(15, 2) NOT NULL,
  "budget_approved" boolean DEFAULT false NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp,
  "procurement_type" varchar(50) NOT NULL,
  "procurement_method" varchar(50) DEFAULT 'competitive_bidding' NOT NULL,
  "minimum_bids_required" varchar(2) DEFAULT '3' NOT NULL,
  "bids_received" varchar(2) DEFAULT '0' NOT NULL,
  "bidding_deadline" timestamp,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "awarded_to" uuid,
  "awarded_amount" numeric(15, 2),
  "awarded_at" timestamp,
  "award_justification" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certification_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "certification_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "alert_type" varchar(50) NOT NULL,
  "alert_date" timestamp DEFAULT now() NOT NULL,
  "expiry_date" date,
  "days_until_expiry" varchar(10),
  "notification_sent" boolean DEFAULT false NOT NULL,
  "notification_sent_at" timestamp,
  "notification_method" varchar(20),
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamp,
  "resolved_by" uuid,
  "resolution_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certification_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "action_type" varchar(50) NOT NULL,
  "action_description" text NOT NULL,
  "certification_id" uuid,
  "user_id" uuid,
  "performed_by" uuid NOT NULL,
  "performed_by_role" varchar(50),
  "compliance_impact" varchar(20),
  "metadata" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certification_compliance_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "report_date" date NOT NULL,
  "report_period" varchar(20) NOT NULL,
  "total_staff" varchar(10) NOT NULL,
  "total_certifications_required" varchar(10) NOT NULL,
  "total_certifications_current" varchar(10) NOT NULL,
  "total_certifications_expired" varchar(10) NOT NULL,
  "total_certifications_pending_renewal" varchar(10) NOT NULL,
  "total_ce_hours_required" varchar(10),
  "total_ce_hours_completed" varchar(10),
  "compliance_rate" varchar(10),
  "expired_certifications" jsonb,
  "upcoming_renewals" jsonb,
  "generated_by" uuid,
  "report_format" varchar(20) DEFAULT 'pdf',
  "report_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certification_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "certification_name" text NOT NULL,
  "certification_code" varchar(50) NOT NULL,
  "issuing_authority" text NOT NULL,
  "requires_renewal" boolean DEFAULT true NOT NULL,
  "renewal_frequency_months" varchar(10),
  "continuing_education_required" boolean DEFAULT false NOT NULL,
  "ce_hours_required" varchar(10),
  "required_for_roles" jsonb,
  "mandatory" boolean DEFAULT false NOT NULL,
  "description" text,
  "application_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "continuing_education" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "certification_id" uuid NOT NULL,
  "course_title" text NOT NULL,
  "course_provider" text NOT NULL,
  "course_date" date NOT NULL,
  "ce_hours_earned" varchar(10) NOT NULL,
  "ce_category" varchar(50),
  "certificate_of_completion" text,
  "verified_by" uuid,
  "verified_at" timestamp,
  "applicable_period_start" date,
  "applicable_period_end" date,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_renewals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "certification_id" uuid NOT NULL,
  "renewal_year" varchar(4) NOT NULL,
  "renewal_due_date" date NOT NULL,
  "renewal_submitted_date" date,
  "renewal_approved_date" date,
  "renewal_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "ce_requirements_met" boolean DEFAULT false NOT NULL,
  "fee_paid" boolean DEFAULT false NOT NULL,
  "application_complete" boolean DEFAULT false NOT NULL,
  "renewal_application" text,
  "payment_receipt" text,
  "approval_letter" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_certifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "role" varchar(100) NOT NULL,
  "certification_type_id" uuid NOT NULL,
  "certification_number" varchar(100),
  "issued_date" date NOT NULL,
  "expiry_date" date,
  "last_renewal_date" date,
  "next_renewal_due" date,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "certificate_document" text,
  "verification_document" text,
  "verified_by" uuid,
  "verified_at" timestamp,
  "verification_notes" text,
  "compliant" boolean DEFAULT true NOT NULL,
  "compliance_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_justification_requests" (
  "id" text NOT NULL PRIMARY KEY,
  "request_date" timestamp DEFAULT now() NOT NULL,
  "requested_by" text NOT NULL,
  "requested_by_email" text NOT NULL,
  "requested_by_role" text NOT NULL,
  "data_type_requested" text NOT NULL,
  "data_type_id" text,
  "justification" text NOT NULL,
  "business_purpose" text,
  "request_status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp,
  "review_decision" text,
  "review_notes" text,
  "approval_expiry_date" timestamp,
  "access_granted_at" timestamp,
  "access_revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_classification_policy" (
  "id" text NOT NULL PRIMARY KEY,
  "policy_name" text NOT NULL,
  "policy_description" text,
  "effective_date" timestamp NOT NULL,
  "expiry_date" timestamp,
  "enforce_strict_separation" boolean DEFAULT true NOT NULL,
  "allow_bargaining_unit_roster" boolean DEFAULT true,
  "allow_grievance_participation" boolean DEFAULT true,
  "block_strike_plans" boolean DEFAULT true NOT NULL,
  "block_membership_lists" boolean DEFAULT true NOT NULL,
  "block_internal_discussions" boolean DEFAULT true NOT NULL,
  "approved_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_classification_registry" (
  "id" text NOT NULL PRIMARY KEY,
  "data_type" text NOT NULL,
  "classification_level" text NOT NULL,
  "accessible_by_employer" boolean DEFAULT false NOT NULL,
  "accessible_by_union" boolean DEFAULT true NOT NULL,
  "requires_justification" boolean DEFAULT false,
  "data_description" text,
  "legal_basis" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employer_access_attempts" (
  "id" text NOT NULL PRIMARY KEY,
  "attempt_timestamp" timestamp DEFAULT now() NOT NULL,
  "user_id" text NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "data_type_requested" text NOT NULL,
  "data_type_id" text,
  "access_granted" boolean DEFAULT false NOT NULL,
  "denial_reason" text,
  "justification_provided" text,
  "ip_address" text,
  "user_agent" text,
  "session_id" text,
  "flagged_for_review" boolean DEFAULT false,
  "reviewed_by" text,
  "reviewed_at" timestamp,
  "review_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firewall_access_rules" (
  "id" text NOT NULL PRIMARY KEY,
  "rule_name" text NOT NULL,
  "data_type_id" text NOT NULL,
  "user_role" text NOT NULL,
  "access_permitted" boolean DEFAULT false NOT NULL,
  "access_level" text,
  "justification_required" boolean DEFAULT false,
  "requires_approval" boolean DEFAULT false,
  "approver_role" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firewall_compliance_audit" (
  "id" text NOT NULL PRIMARY KEY,
  "audit_date" timestamp DEFAULT now() NOT NULL,
  "audit_period" text NOT NULL,
  "total_access_attempts" text NOT NULL,
  "total_employer_attempts" text NOT NULL,
  "total_denied_access" text NOT NULL,
  "total_violations" text NOT NULL,
  "critical_violations" text NOT NULL,
  "compliance_rate" text NOT NULL,
  "top_violated_data_types" jsonb,
  "recommended_actions" text,
  "audited_by" text NOT NULL,
  "audit_report" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firewall_violations" (
  "id" text NOT NULL PRIMARY KEY,
  "violation_date" timestamp DEFAULT now() NOT NULL,
  "violation_type" text NOT NULL,
  "severity" text NOT NULL,
  "user_id" text NOT NULL,
  "user_email" text NOT NULL,
  "user_role" text NOT NULL,
  "data_type_accessed" text,
  "data_type_id" text,
  "violation_description" text NOT NULL,
  "system_detected" boolean DEFAULT true NOT NULL,
  "detected_by" text,
  "incident_status" text DEFAULT 'open' NOT NULL,
  "investigated_by" text,
  "investigation_notes" text,
  "resolution_action" text,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "union_only_data_tags" (
  "id" text NOT NULL PRIMARY KEY,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "resource_name" text,
  "union_only_flag" boolean DEFAULT true NOT NULL,
  "employer_access_blocked" boolean DEFAULT true NOT NULL,
  "classification_level" text DEFAULT 'union_only' NOT NULL,
  "tagged_by" text NOT NULL,
  "tagged_at" timestamp DEFAULT now() NOT NULL,
  "tag_reason" text,
  "review_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_balance_reconciliation" (
  "id" text NOT NULL PRIMARY KEY,
  "reconciliation_date" timestamp DEFAULT now() NOT NULL,
  "account_id" text NOT NULL,
  "account_type" text NOT NULL,
  "stripe_reported_balance" text NOT NULL,
  "system_calculated_balance" text NOT NULL,
  "balance_match" boolean NOT NULL,
  "discrepancy_amount" text,
  "discrepancy_reason" text,
  "reconciliation_status" text DEFAULT 'pending' NOT NULL,
  "reconciled_by" text,
  "reconciliation_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_classification_policy" (
  "id" text NOT NULL PRIMARY KEY,
  "policy_name" text NOT NULL,
  "policy_description" text,
  "effective_date" timestamp NOT NULL,
  "expiry_date" timestamp,
  "enforce_strict_separation" boolean DEFAULT true NOT NULL,
  "allow_operational_fallback" boolean DEFAULT false NOT NULL,
  "require_trust_account" boolean DEFAULT true NOT NULL,
  "automatic_classification" boolean DEFAULT true NOT NULL,
  "approved_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_routing_rules" (
  "id" text NOT NULL PRIMARY KEY,
  "payment_type" text NOT NULL,
  "payment_category" text NOT NULL,
  "destination_account_id" text NOT NULL,
  "destination_account_type" text NOT NULL,
  "routing_mandatory" boolean DEFAULT true NOT NULL,
  "fallback_account_id" text,
  "allow_fallback" boolean DEFAULT false NOT NULL,
  "routing_priority" text DEFAULT '1' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "separated_payment_transactions" (
  "id" text NOT NULL PRIMARY KEY,
  "transaction_date" timestamp DEFAULT now() NOT NULL,
  "payment_type" text NOT NULL,
  "payment_category" text NOT NULL,
  "payment_amount" text NOT NULL,
  "payment_currency" text DEFAULT 'CAD' NOT NULL,
  "payer_id" text NOT NULL,
  "payer_email" text NOT NULL,
  "payee_id" text,
  "payee_name" text,
  "stripe_payment_intent_id" text,
  "stripe_charge_id" text,
  "routed_to_account_id" text NOT NULL,
  "routed_to_account_type" text NOT NULL,
  "routing_rule_id" text,
  "separation_enforced" boolean DEFAULT true NOT NULL,
  "correct_account_used" boolean DEFAULT true NOT NULL,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "failure_reason" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strike_fund_payment_audit" (
  "id" text NOT NULL PRIMARY KEY,
  "audit_date" timestamp DEFAULT now() NOT NULL,
  "audit_period" text NOT NULL,
  "total_strike_payments" text NOT NULL,
  "total_strike_amount" text NOT NULL,
  "strike_payments_to_correct_account" text NOT NULL,
  "strike_payments_to_wrong_account" text NOT NULL,
  "total_operational_payments" text NOT NULL,
  "total_operational_amount" text NOT NULL,
  "separation_compliance_rate" text NOT NULL,
  "total_violations" text NOT NULL,
  "critical_violations" text NOT NULL,
  "amount_misrouted" text,
  "recommended_actions" text,
  "audited_by" text NOT NULL,
  "audit_report" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_connect_accounts" (
  "id" text NOT NULL PRIMARY KEY,
  "account_type" text NOT NULL,
  "account_purpose" text NOT NULL,
  "stripe_account_id" text NOT NULL,
  "account_status" text DEFAULT 'active' NOT NULL,
  "account_email" text NOT NULL,
  "account_name" text NOT NULL,
  "country" text DEFAULT 'CA' NOT NULL,
  "currency" text DEFAULT 'CAD' NOT NULL,
  "separate_account" boolean DEFAULT true NOT NULL,
  "trust_account_designation" boolean DEFAULT false,
  "bank_account_last4" text,
  "bank_name" text,
  "account_verified" boolean DEFAULT false NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whiplash_prevention_audit" (
  "id" text NOT NULL PRIMARY KEY,
  "audit_date" timestamp DEFAULT now() NOT NULL,
  "action_type" text NOT NULL,
  "action_description" text NOT NULL,
  "account_id" text,
  "transaction_id" text,
  "performed_by" text NOT NULL,
  "compliance_impact" text,
  "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whiplash_violations" (
  "id" text NOT NULL PRIMARY KEY,
  "violation_date" timestamp DEFAULT now() NOT NULL,
  "violation_type" text NOT NULL,
  "severity" text NOT NULL,
  "transaction_id" text,
  "payment_type" text NOT NULL,
  "expected_account_id" text,
  "actual_account_id" text,
  "violation_description" text NOT NULL,
  "amount_involved" text,
  "correction_required" boolean DEFAULT true NOT NULL,
  "correction_action" text,
  "violation_status" text DEFAULT 'open' NOT NULL,
  "detected_by" text,
  "resolved_by" text,
  "resolved_at" timestamp,
  "resolution_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
