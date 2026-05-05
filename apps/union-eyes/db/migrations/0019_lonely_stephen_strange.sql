CREATE TYPE "public"."committee_member_role" AS ENUM('chair', 'vice_chair', 'secretary', 'treasurer', 'member', 'alternate', 'advisor', 'ex_officio');--> statement-breakpoint
CREATE TYPE "public"."committee_type" AS ENUM('bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education', 'organizing', 'steward', 'executive', 'finance', 'communications', 'social', 'pension_benefits', 'other');--> statement-breakpoint
CREATE TYPE "public"."employer_status" AS ENUM('active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived');--> statement-breakpoint
CREATE TYPE "public"."employer_type" AS ENUM('private', 'public', 'non_profit', 'crown_corporation', 'municipal', 'provincial', 'federal', 'educational', 'healthcare');--> statement-breakpoint
CREATE TYPE "public"."steward_type" AS ENUM('chief_steward', 'steward', 'alternate_steward', 'health_safety_rep');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional');--> statement-breakpoint
CREATE TYPE "public"."worksite_status" AS ENUM('active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived');--> statement-breakpoint
CREATE TABLE "bargaining_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"worksite_id" uuid,
	"name" varchar(255) NOT NULL,
	"unit_number" varchar(50),
	"unit_type" "unit_type" NOT NULL,
	"status" "unit_status" DEFAULT 'active' NOT NULL,
	"certification_number" varchar(100),
	"certification_date" date,
	"certification_body" varchar(100),
	"certification_expiry_date" date,
	"current_collective_agreement_id" uuid,
	"contract_expiry_date" date,
	"next_bargaining_date" date,
	"member_count" integer DEFAULT 0,
	"classifications" jsonb,
	"chief_steward_id" text,
	"bargaining_chair_id" text,
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
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
CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"committee_type" "committee_type" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"unit_id" uuid,
	"worksite_id" uuid,
	"is_organization_wide" boolean DEFAULT false,
	"mandate" text,
	"meeting_frequency" varchar(100),
	"meeting_day" varchar(50),
	"meeting_time" varchar(50),
	"meeting_location" text,
	"max_members" integer,
	"current_member_count" integer DEFAULT 0,
	"requires_appointment" boolean DEFAULT false,
	"requires_election" boolean DEFAULT false,
	"term_length" integer,
	"chair_id" text,
	"secretary_id" text,
	"contact_email" varchar(255),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"dba_name" varchar(255),
	"employer_type" "employer_type" NOT NULL,
	"status" "employer_status" DEFAULT 'active' NOT NULL,
	"business_number" varchar(50),
	"federal_corporation_number" varchar(50),
	"provincial_corporation_number" varchar(50),
	"industry_code" varchar(20),
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(500),
	"main_address" jsonb,
	"total_employees" integer,
	"unionized_employees" integer,
	"established_date" date,
	"primary_contact_name" varchar(255),
	"primary_contact_title" varchar(255),
	"primary_contact_email" varchar(255),
	"primary_contact_phone" varchar(50),
	"labour_relations_contact_name" varchar(255),
	"labour_relations_contact_email" varchar(255),
	"labour_relations_contact_phone" varchar(50),
	"parent_company_id" uuid,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
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
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "worksites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"status" "worksite_status" DEFAULT 'active' NOT NULL,
	"address" jsonb,
	"employee_count" integer,
	"shift_count" integer,
	"operates_weekends" boolean DEFAULT false,
	"operates_24_hours" boolean DEFAULT false,
	"site_manager_name" varchar(255),
	"site_manager_email" varchar(255),
	"site_manager_phone" varchar(50),
	"description" text,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_by" text,
	"updated_by" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
DROP TABLE IF EXISTS "pending_profiles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_management"."oauth_providers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_management"."organization_users" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_management"."user_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_management"."users" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_deadlines" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "claim_updates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "claims" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arbitrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_responses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_timeline" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "settlements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "deadline_alerts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "deadline_extensions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "deadline_rules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "claim_deadlines" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "holidays" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_approvals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_assignments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_communications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_settlements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_stages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_transitions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "grievance_workflows" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cba_contacts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cba_version_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "collective_agreements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "benefit_comparisons" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cba_clauses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clause_comparisons" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "wage_progressions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arbitration_decisions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arbitrator_profiles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bargaining_notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cba_footnotes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "claim_precedent_analysis" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clause_comparisons_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clause_library_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shared_clause_library" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bargaining_proposals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bargaining_team_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "negotiation_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "negotiations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tentative_agreements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "dues_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "autopay_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bank_reconciliation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_cycles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_disputes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_methods" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stripe_webhook_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chart_of_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cost_centers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "gl_account_mappings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "gl_transaction_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "gl_trial_balance" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "rl1_tax_slips" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "strike_fund_disbursements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t4a_tax_slips" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tax_year_end_processing" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "weekly_threshold_tracking" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bank_of_canada_rates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cross_border_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "currency_enforcement_audit" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "currency_enforcement_policy" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "currency_enforcement_violations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "exchange_rates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "fx_rate_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "t106_filing_tracking" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "transaction_currency_conversions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "transfer_pricing_documentation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "council_elections" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "golden_shares" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "governance_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "mission_audits" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reserved_matter_votes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arms_length_verification" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "blind_trust_registry" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "conflict_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "conflict_disclosures" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "conflict_of_interest_policy" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "conflict_review_committee" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "conflict_training" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recusal_tracking" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "voter_eligibility" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "votes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "voting_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "voting_notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "voting_options" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "voting_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_participants" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_read_receipts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "message_threads" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "in_app_notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_bounces" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_delivery_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_queue" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_tracking" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_notification_preferences" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_distribution_lists" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_engagement" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_list_subscribers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_recipients" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "newsletter_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_campaign_recipients" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_conversations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_opt_outs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_rate_limits" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sms_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "poll_votes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "polls" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "survey_answers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "survey_questions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "survey_responses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "surveys" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "analytics_metrics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "comparative_analyses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "insight_recommendations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "kpi_configurations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ml_predictions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "trend_analyses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "push_deliveries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "push_devices" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "push_notification_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "push_notifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "document_folders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "member_documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "document_signers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_audit_trail" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_webhooks_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_verification" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signature_workflows" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "signers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "calendar_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "calendar_sharing" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "calendars" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "event_attendees" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "event_reminders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_calendar_connections" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "meeting_rooms" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "room_bookings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "course_registrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "course_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "member_certifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "program_enrollments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "training_courses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "training_programs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_subject_access_requests" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "privacy_breaches" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "provincial_consent" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "provincial_data_handling" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "provincial_privacy_config" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cookie_consents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_anonymization_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_processing_records" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_retention_policies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "gdpr_data_requests" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_consents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "geofence_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "geofences" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "location_deletion_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "location_tracking" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "location_tracking_audit" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "location_tracking_config" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "member_location_consent" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "band_council_consent" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "band_councils" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "indigenous_data_access_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "indigenous_data_sharing_agreements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "indigenous_member_data" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "traditional_knowledge_registry" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "foreign_workers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "gss_applications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lmbp_compliance_alerts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lmbp_compliance_reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lmbp_letters" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "mentorships" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "break_glass_activations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "break_glass_system" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "disaster_recovery_drills" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "emergency_declarations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "key_holder_registry" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recovery_time_objectives" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "swiss_cold_storage" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "access_justification_requests" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_classification_policy" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "data_classification_registry" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "employer_access_attempts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "firewall_access_rules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "firewall_compliance_audit" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "firewall_violations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "union_only_data_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "account_balance_reconciliation" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_classification_policy" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "payment_routing_rules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "separated_payment_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "strike_fund_payment_audit" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "stripe_connect_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "whiplash_prevention_audit" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "whiplash_violations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "certification_alerts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "certification_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "certification_compliance_reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "certification_types" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "continuing_education" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "license_renewals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "staff_certifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "contribution_rates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cost_of_living_data" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_data_sync_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "union_density" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "wage_benchmarks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lrb_agreements" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lrb_employers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lrb_sync_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "lrb_unions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "arbitration_precedents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "precedent_citations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "precedent_tags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "congress_memberships" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_departments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_employees" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_positions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_customers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_invoices" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_payments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_benefit_coverage" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_benefit_dependents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_benefit_enrollments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_benefit_plans" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_benefit_utilization" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_insurance_beneficiaries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_insurance_claims" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_insurance_policies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_communication_channels" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_communication_files" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_communication_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_communication_users" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_lms_completions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_lms_courses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_lms_enrollments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_lms_learners" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_lms_progress" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_document_files" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_document_libraries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_document_permissions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "external_document_sites" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "model_metadata" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ai_safety_filters" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chat_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chat_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chatbot_analytics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "chatbot_suggestions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "knowledge_base" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "analytics_scheduled_reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "benchmark_categories" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "benchmark_data" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organization_benchmark_snapshots" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "report_delivery_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "report_executions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "report_shares" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "report_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scheduled_reports" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "automation_rules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_sync_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_webhook_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reward_wallet_ledger" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_security"."audit_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_security"."failed_login_attempts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_security"."rate_limit_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "audit_security"."security_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "feature_flags" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user_uuid_mapping" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_actions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_conditions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_escalations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_executions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_recipients" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "alert_rules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_definitions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_executions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "automation_execution_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "automation_schedules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recognition_award_types" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recognition_awards" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recognition_programs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reward_budget_envelopes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reward_redemptions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shopify_config" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "webhook_receipts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "award_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "award_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "budget_pool" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "budget_reservations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "card_signing_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "employer_responses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "field_organizer_activities" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "nlrb_clrb_filings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organizing_campaign_milestones" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organizing_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organizing_contacts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "union_representation_votes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cross_org_access_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organization_sharing_grants" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organization_sharing_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_blocks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_media_library" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_navigation_menus" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_pages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cms_templates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "donation_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "donation_receipts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "donations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "event_check_ins" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "event_registrations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "job_applications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "job_postings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "job_saved" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "page_analytics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "public_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "website_settings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bank_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bank_reconciliations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "bank_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "currency_exchange_rates" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "erp_connectors" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "erp_invoices" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "financial_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "journal_entries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "journal_entry_lines" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sync_jobs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_bargaining_trends" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_oauth_tokens" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_per_capita_benchmarks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_union_density" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_api_config" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_remittance_mapping" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_chart_of_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "notification_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "organization_contacts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "per_capita_remittances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "remittance_approvals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "clc_organization_sync_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "address_change_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "address_validation_cache" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "country_address_formats" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "international_addresses" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_analytics" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_campaigns" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_engagement" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_feeds" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "social_posts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cpi_adjusted_pricing" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "cpi_data" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "fmv_audit_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "fmv_benchmarks" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "fmv_policy" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "fmv_violations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "independent_appraisals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "procurement_bids" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "procurement_requests" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "defensibility_packs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "pack_download_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "pack_verification_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "accessibility_audits" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "accessibility_issues" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "accessibility_test_suites" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "accessibility_user_testing" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "wcag_success_criteria" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "knowledge_base_articles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "sla_policies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "support_tickets" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_comments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ticket_history" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "integration_configs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "integration_sync_log" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "integration_sync_schedules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "webhook_events" CASCADE;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_chief_steward_id_profiles_user_id_fk" FOREIGN KEY ("chief_steward_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_bargaining_chair_id_profiles_user_id_fk" FOREIGN KEY ("bargaining_chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_units" ADD CONSTRAINT "bargaining_units_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_appointed_by_profiles_user_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committee_memberships" ADD CONSTRAINT "committee_memberships_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_unit_id_bargaining_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_chair_id_profiles_user_id_fk" FOREIGN KEY ("chair_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_secretary_id_profiles_user_id_fk" FOREIGN KEY ("secretary_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "committees" ADD CONSTRAINT "committees_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employers" ADD CONSTRAINT "employers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employers" ADD CONSTRAINT "employers_parent_company_id_employers_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."employers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employers" ADD CONSTRAINT "employers_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employers" ADD CONSTRAINT "employers_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_member_id_profiles_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_ended_by_profiles_user_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_tenure_history" ADD CONSTRAINT "role_tenure_history_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_steward_id_profiles_user_id_fk" FOREIGN KEY ("steward_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_unit_id_bargaining_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."bargaining_units"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_appointed_by_profiles_user_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "steward_assignments" ADD CONSTRAINT "steward_assignments_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "worksites" ADD CONSTRAINT "worksites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "worksites" ADD CONSTRAINT "worksites_employer_id_employers_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "worksites" ADD CONSTRAINT "worksites_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "worksites" ADD CONSTRAINT "worksites_updated_by_profiles_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_organization" ON "bargaining_units" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_employer" ON "bargaining_units" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_worksite" ON "bargaining_units" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_status" ON "bargaining_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_unit_number" ON "bargaining_units" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "idx_bargaining_units_contract_expiry" ON "bargaining_units" USING btree ("contract_expiry_date");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_committee" ON "committee_memberships" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_member" ON "committee_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_status" ON "committee_memberships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_role" ON "committee_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_committee_memberships_tenure" ON "committee_memberships" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_committee_memberships_unique" ON "committee_memberships" USING btree ("committee_id","member_id","start_date");--> statement-breakpoint
CREATE INDEX "idx_committees_organization" ON "committees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_committees_type" ON "committees" USING btree ("committee_type");--> statement-breakpoint
CREATE INDEX "idx_committees_status" ON "committees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_committees_unit" ON "committees" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_committees_worksite" ON "committees" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_committees_chair" ON "committees" USING btree ("chair_id");--> statement-breakpoint
CREATE INDEX "idx_employers_organization" ON "employers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employers_status" ON "employers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_employers_name" ON "employers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_employers_parent_company" ON "employers" USING btree ("parent_company_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_organization" ON "role_tenure_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_member" ON "role_tenure_history" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_role_type" ON "role_tenure_history" USING btree ("role_type");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_current" ON "role_tenure_history" USING btree ("is_current_role");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_dates" ON "role_tenure_history" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_role_tenure_entity" ON "role_tenure_history" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_organization" ON "steward_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_steward" ON "steward_assignments" USING btree ("steward_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_unit" ON "steward_assignments" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_worksite" ON "steward_assignments" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_status" ON "steward_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_type" ON "steward_assignments" USING btree ("steward_type");--> statement-breakpoint
CREATE INDEX "idx_steward_assignments_tenure" ON "steward_assignments" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_worksites_organization" ON "worksites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_worksites_employer" ON "worksites" USING btree ("employer_id");--> statement-breakpoint
CREATE INDEX "idx_worksites_status" ON "worksites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_worksites_code" ON "worksites" USING btree ("code");--> statement-breakpoint
DROP TYPE IF EXISTS "public"."claim_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."claim_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."claim_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."visibility_scope";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."arbitration_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_step";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."settlement_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_severity";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deadline_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."deadline_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."delivery_method";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."delivery_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."extension_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."assignment_role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."assignment_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."document_version_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_stage_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."grievance_workflow_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."settlement_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."transition_trigger_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cba_language";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cba_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cba_jurisdiction";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."clause_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."entity_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."decision_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."outcome";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."precedent_value";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."tribunal_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."negotiation_session_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."negotiation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."proposal_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."proposal_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."bargaining_team_role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_processor";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."transaction_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."transaction_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_method";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."payment_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."reconciliation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."account_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."account_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."cost_center_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."message_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."message_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."digest_frequency";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_bounce_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_channel";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_queue_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_schedule_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_template_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_template_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."notification_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_bounce_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_campaign_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_engagement_event";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_list_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_recipient_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."newsletter_subscriber_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."template_category";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."push_delivery_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."push_notification_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."push_platform";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."push_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."signature_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."signer_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."authentication_method";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."signature_document_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."signature_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."signature_workflow_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."attendee_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."calendar_permission";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."event_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."event_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."room_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."sync_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."consent_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."consent_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."gdpr_request_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."gdpr_request_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."processing_purpose";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."congress_membership_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."employment_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."external_hris_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ai_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."chat_session_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."knowledge_document_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."message_role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."report_category";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."report_format";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."report_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."schedule_frequency";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_action_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_condition_operator";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_execution_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_frequency";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."alert_trigger_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."escalation_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."workflow_action_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."workflow_execution_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."workflow_trigger_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."award_kind";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."budget_period";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."budget_scope_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."program_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."redemption_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."redemption_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."wallet_event_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."wallet_source_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."webhook_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."audit_action";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."erp_system";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."sync_direction";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."clc_sync_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."clc_webhook_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."address_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."address_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."engagement_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_account_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_platform";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_post_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_post_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."a11y_issue_severity";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."a11y_issue_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."audit_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."wcag_level";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ticket_category";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ticket_priority";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ticket_source";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."ticket_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."integration_provider";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."integration_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."sync_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."webhook_status";--> statement-breakpoint
DROP SCHEMA IF EXISTS "user_management" CASCADE;
--> statement-breakpoint
DROP SCHEMA IF EXISTS "audit_security" CASCADE;





