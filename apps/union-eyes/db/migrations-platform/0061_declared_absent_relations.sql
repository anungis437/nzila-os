-- Platform migration declared-absent-relations
--
-- Creates 23 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: anti_scab_violations, cnesst_filings, joint_hs_committees, pay_equity_exercises, preventive_withdrawals, right_of_refusal_events, wcb_claims, wcb_employer_assessments, member_dues_issues, payroll_deductions, customer_nps_surveys, customer_onboarding_milestones, cba_intel_sources, cba_intel_ingestion_jobs, cba_intel_documents, cba_intel_agreements, cba_intel_clauses, cba_intel_extraction_runs, cba_intel_findings, cba_intel_wage_adjustments, cba_intel_review_decisions, cba_intel_benchmark_snapshots, cba_intel_freshness_log.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=anti_scab_violations,cnesst_filings,joint_hs_committees,pay_equity_exercises,preventive_withdrawals,right_of_refusal_events,wcb_claims,wcb_employer_assessments,member_dues_issues,payroll_deductions,customer_nps_surveys,customer_onboarding_milestones,cba_intel_sources,cba_intel_ingestion_jobs,cba_intel_documents,cba_intel_agreements,cba_intel_clauses,cba_intel_extraction_runs,cba_intel_findings,cba_intel_wage_adjustments,cba_intel_review_decisions,cba_intel_benchmark_snapshots,cba_intel_freshness_log --label=declared-absent-relations
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_create$
DECLARE
  present text[];
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: public.organizations does not exist (a foreign key target).';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO present FROM unnest(ARRAY['anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals', 'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions', 'customer_nps_surveys', 'customer_onboarding_milestones', 'cba_intel_sources', 'cba_intel_ingestion_jobs', 'cba_intel_documents', 'cba_intel_agreements', 'cba_intel_clauses', 'cba_intel_extraction_runs', 'cba_intel_findings', 'cba_intel_wage_adjustments', 'cba_intel_review_decisions', 'cba_intel_benchmark_snapshots', 'cba_intel_freshness_log']) AS t WHERE to_regclass('public.' || t) IS NOT NULL;
  IF present IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: relations already exist and are not replaced: %', present;
  END IF;
END $ue_create$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.anti_scab_violation_type') IS NULL THEN
    CREATE TYPE public.anti_scab_violation_type AS ENUM ('replacement_workers', 'other_establishment', 'subcontractors', 'post_notice_hires');
    COMMENT ON TYPE public.anti_scab_violation_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.anti_scab_violation_type')) IS DISTINCT FROM ARRAY['replacement_workers', 'other_establishment', 'subcontractors', 'post_notice_hires']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type anti_scab_violation_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_clause_family') IS NULL THEN
    CREATE TYPE public.cba_intel_clause_family AS ENUM ('wages', 'premiums', 'hours_of_work', 'overtime', 'scheduling', 'leave_general', 'vacation', 'sick_leave', 'health_benefits', 'pension', 'mileage_travel', 'remote_hybrid', 'grievance', 'arbitration', 'seniority', 'job_posting_bidding', 'health_safety', 'training', 'discipline_discharge', 'contracting_out', 'union_rights', 'management_rights', 'layoffs_recall', 'technological_change', 'equity_harassment', 'other');
    COMMENT ON TYPE public.cba_intel_clause_family IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_clause_family')) IS DISTINCT FROM ARRAY['wages', 'premiums', 'hours_of_work', 'overtime', 'scheduling', 'leave_general', 'vacation', 'sick_leave', 'health_benefits', 'pension', 'mileage_travel', 'remote_hybrid', 'grievance', 'arbitration', 'seniority', 'job_posting_bidding', 'health_safety', 'training', 'discipline_discharge', 'contracting_out', 'union_rights', 'management_rights', 'layoffs_recall', 'technological_change', 'equity_harassment', 'other']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_clause_family exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_collection_method') IS NULL THEN
    CREATE TYPE public.cba_intel_collection_method AS ENUM ('manual_upload', 'scheduled_fetch', 'api_sync', 'rss_feed', 'email_ingest');
    COMMENT ON TYPE public.cba_intel_collection_method IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_collection_method')) IS DISTINCT FROM ARRAY['manual_upload', 'scheduled_fetch', 'api_sync', 'rss_feed', 'email_ingest']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_collection_method exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_doc_processing_status') IS NULL THEN
    CREATE TYPE public.cba_intel_doc_processing_status AS ENUM ('fetched', 'normalized', 'parsed', 'extracted', 'reviewed', 'failed');
    COMMENT ON TYPE public.cba_intel_doc_processing_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_doc_processing_status')) IS DISTINCT FROM ARRAY['fetched', 'normalized', 'parsed', 'extracted', 'reviewed', 'failed']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_doc_processing_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_doc_type') IS NULL THEN
    CREATE TYPE public.cba_intel_doc_type AS ENUM ('full_agreement', 'settlement_summary', 'wage_reopener', 'memorandum_of_agreement', 'arbitration_decision', 'bulletin', 'news_article', 'statistical_report', 'other');
    COMMENT ON TYPE public.cba_intel_doc_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_doc_type')) IS DISTINCT FROM ARRAY['full_agreement', 'settlement_summary', 'wage_reopener', 'memorandum_of_agreement', 'arbitration_decision', 'bulletin', 'news_article', 'statistical_report', 'other']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_doc_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_extraction_method') IS NULL THEN
    CREATE TYPE public.cba_intel_extraction_method AS ENUM ('deterministic', 'llm_gpt4', 'llm_gpt4_vision', 'hybrid', 'manual');
    COMMENT ON TYPE public.cba_intel_extraction_method IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_extraction_method')) IS DISTINCT FROM ARRAY['deterministic', 'llm_gpt4', 'llm_gpt4_vision', 'hybrid', 'manual']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_extraction_method exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_extraction_status') IS NULL THEN
    CREATE TYPE public.cba_intel_extraction_status AS ENUM ('pending', 'running', 'completed', 'completed_with_errors', 'failed');
    COMMENT ON TYPE public.cba_intel_extraction_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_extraction_status')) IS DISTINCT FROM ARRAY['pending', 'running', 'completed', 'completed_with_errors', 'failed']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_extraction_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_failure_class') IS NULL THEN
    CREATE TYPE public.cba_intel_failure_class AS ENUM ('network', 'auth', 'parse', 'rate_limit', 'schema_mismatch', 'timeout', 'unknown');
    COMMENT ON TYPE public.cba_intel_failure_class IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_failure_class')) IS DISTINCT FROM ARRAY['network', 'auth', 'parse', 'rate_limit', 'schema_mismatch', 'timeout', 'unknown']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_failure_class exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_freshness_status') IS NULL THEN
    CREATE TYPE public.cba_intel_freshness_status AS ENUM ('fresh', 'aging', 'stale', 'expired', 'unknown');
    COMMENT ON TYPE public.cba_intel_freshness_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_freshness_status')) IS DISTINCT FROM ARRAY['fresh', 'aging', 'stale', 'expired', 'unknown']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_freshness_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_ingestion_status') IS NULL THEN
    CREATE TYPE public.cba_intel_ingestion_status AS ENUM ('queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled');
    COMMENT ON TYPE public.cba_intel_ingestion_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_ingestion_status')) IS DISTINCT FROM ARRAY['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_ingestion_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_review_status') IS NULL THEN
    CREATE TYPE public.cba_intel_review_status AS ENUM ('pending_review', 'approved', 'rejected', 'superseded', 'needs_followup');
    COMMENT ON TYPE public.cba_intel_review_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_review_status')) IS DISTINCT FROM ARRAY['pending_review', 'approved', 'rejected', 'superseded', 'needs_followup']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_review_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_review_target_type') IS NULL THEN
    CREATE TYPE public.cba_intel_review_target_type AS ENUM ('finding', 'agreement', 'wage_adjustment', 'clause');
    COMMENT ON TYPE public.cba_intel_review_target_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_review_target_type')) IS DISTINCT FROM ARRAY['finding', 'agreement', 'wage_adjustment', 'clause']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_review_target_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_source_health') IS NULL THEN
    CREATE TYPE public.cba_intel_source_health AS ENUM ('healthy', 'degraded', 'unreachable', 'unknown');
    COMMENT ON TYPE public.cba_intel_source_health IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_source_health')) IS DISTINCT FROM ARRAY['healthy', 'degraded', 'unreachable', 'unknown']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_source_health exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_source_type') IS NULL THEN
    CREATE TYPE public.cba_intel_source_type AS ENUM ('federal_labour', 'provincial_labour_board', 'provincial_ministry', 'quebec_labour', 'legal_arbitration', 'union_bulletin', 'stats_benchmark', 'academic', 'news');
    COMMENT ON TYPE public.cba_intel_source_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_source_type')) IS DISTINCT FROM ARRAY['federal_labour', 'provincial_labour_board', 'provincial_ministry', 'quebec_labour', 'legal_arbitration', 'union_bulletin', 'stats_benchmark', 'academic', 'news']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_source_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cba_intel_trust_tier') IS NULL THEN
    CREATE TYPE public.cba_intel_trust_tier AS ENUM ('official', 'authoritative', 'curated', 'unverified');
    COMMENT ON TYPE public.cba_intel_trust_tier IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cba_intel_trust_tier')) IS DISTINCT FROM ARRAY['official', 'authoritative', 'curated', 'unverified']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cba_intel_trust_tier exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cnesst_filing_status') IS NULL THEN
    CREATE TYPE public.cnesst_filing_status AS ENUM ('draft', 'submitted', 'acknowledged', 'under_investigation', 'mediation', 'awaiting_decision', 'accepted', 'denied', 'appealed_tat', 'settled', 'closed');
    COMMENT ON TYPE public.cnesst_filing_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cnesst_filing_status')) IS DISTINCT FROM ARRAY['draft', 'submitted', 'acknowledged', 'under_investigation', 'mediation', 'awaiting_decision', 'accepted', 'denied', 'appealed_tat', 'settled', 'closed']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cnesst_filing_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.cnesst_filing_type') IS NULL THEN
    CREATE TYPE public.cnesst_filing_type AS ENUM ('workplace_accident', 'occupational_disease', 'preventive_withdrawal', 'right_of_refusal', 'harassment_complaint', 'standards_complaint', 'pay_equity', 'dangerous_conditions');
    COMMENT ON TYPE public.cnesst_filing_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.cnesst_filing_type')) IS DISTINCT FROM ARRAY['workplace_accident', 'occupational_disease', 'preventive_withdrawal', 'right_of_refusal', 'harassment_complaint', 'standards_complaint', 'pay_equity', 'dangerous_conditions']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type cnesst_filing_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.pay_equity_status') IS NULL THEN
    CREATE TYPE public.pay_equity_status AS ENUM ('not_started', 'committee_formed', 'evaluation_in_progress', 'adjustments_calculated', 'results_posted', 'adjustments_paid', 'maintenance_due', 'maintenance_completed', 'contested');
    COMMENT ON TYPE public.pay_equity_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.pay_equity_status')) IS DISTINCT FROM ARRAY['not_started', 'committee_formed', 'evaluation_in_progress', 'adjustments_calculated', 'results_posted', 'adjustments_paid', 'maintenance_due', 'maintenance_completed', 'contested']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type pay_equity_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.preventive_withdrawal_reason') IS NULL THEN
    CREATE TYPE public.preventive_withdrawal_reason AS ENUM ('pregnancy', 'breastfeeding', 'hazardous_exposure');
    COMMENT ON TYPE public.preventive_withdrawal_reason IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.preventive_withdrawal_reason')) IS DISTINCT FROM ARRAY['pregnancy', 'breastfeeding', 'hazardous_exposure']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type preventive_withdrawal_reason exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.right_of_refusal_outcome') IS NULL THEN
    CREATE TYPE public.right_of_refusal_outcome AS ENUM ('danger_confirmed', 'danger_not_confirmed', 'partial_correction', 'referred_to_cnesst', 'pending');
    COMMENT ON TYPE public.right_of_refusal_outcome IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.right_of_refusal_outcome')) IS DISTINCT FROM ARRAY['danger_confirmed', 'danger_not_confirmed', 'partial_correction', 'referred_to_cnesst', 'pending']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type right_of_refusal_outcome exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.wcb_claim_status') IS NULL THEN
    CREATE TYPE public.wcb_claim_status AS ENUM ('draft', 'submitted', 'accepted', 'denied', 'under_review', 'appealed', 'closed');
    COMMENT ON TYPE public.wcb_claim_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.wcb_claim_status')) IS DISTINCT FROM ARRAY['draft', 'submitted', 'accepted', 'denied', 'under_review', 'appealed', 'closed']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type wcb_claim_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.wcb_claim_type') IS NULL THEN
    CREATE TYPE public.wcb_claim_type AS ENUM ('workplace_injury', 'occupational_disease', 'mental_health', 'repetitive_strain', 'fatality');
    COMMENT ON TYPE public.wcb_claim_type IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.wcb_claim_type')) IS DISTINCT FROM ARRAY['workplace_injury', 'occupational_disease', 'mental_health', 'repetitive_strain', 'fatality']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type wcb_claim_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.wcb_jurisdiction') IS NULL THEN
    CREATE TYPE public.wcb_jurisdiction AS ENUM ('federal', 'ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'QC', 'YT', 'NT', 'NU');
    COMMENT ON TYPE public.wcb_jurisdiction IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.wcb_jurisdiction')) IS DISTINCT FROM ARRAY['federal', 'ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'QC', 'YT', 'NT', 'NU']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type wcb_jurisdiction exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.wcb_return_to_work_status') IS NULL THEN
    CREATE TYPE public.wcb_return_to_work_status AS ENUM ('not_applicable', 'modified_duties', 'gradual_return', 'full_return', 'permanent_disability');
    COMMENT ON TYPE public.wcb_return_to_work_status IS 'platform-migration:declared-absent-relations';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.wcb_return_to_work_status')) IS DISTINCT FROM ARRAY['not_applicable', 'modified_duties', 'gradual_return', 'full_return', 'permanent_disability']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations fail-closed: enum type wcb_return_to_work_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
CREATE TABLE public."anti_scab_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"strike_or_lockout_start_date" date NOT NULL,
	"is_strike" boolean NOT NULL,
	"bargaining_unit_description" text,
	"violation_type" "anti_scab_violation_type" NOT NULL,
	"violation_date" date NOT NULL,
	"description" text NOT NULL,
	"description_fr" text,
	"evidence_summary" text,
	"replacement_worker_count" integer,
	"tat_complaint_filed" boolean DEFAULT false,
	"tat_complaint_date" date,
	"tat_file_number" varchar(100),
	"injunction_requested" boolean DEFAULT false,
	"injunction_granted" boolean,
	"injunction_date" date,
	"penalty_amount" numeric(12, 2),
	"days_of_violation" integer,
	"resolved" boolean DEFAULT false,
	"resolution_notes" text,
	"reported_by_id" uuid,
	"reported_by_name" varchar(255),
	"document_ids" jsonb,
	"metadata" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."anti_scab_violations" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."anti_scab_violations" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."anti_scab_violations" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."anti_scab_violations" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cnesst_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid,
	"incident_id" uuid,
	"filing_type" "cnesst_filing_type" NOT NULL,
	"status" "cnesst_filing_status" DEFAULT 'draft' NOT NULL,
	"cnesst_file_number" varchar(100),
	"tat_appeal_number" varchar(100),
	"internal_case_number" varchar(100),
	"legal_basis" varchar(255) NOT NULL,
	"filing_deadline" date,
	"filed_date" date,
	"acknowledged_date" date,
	"decision_date" date,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"description_fr" text,
	"relief_sought" text,
	"relief_sought_fr" text,
	"outcome" text,
	"outcome_fr" text,
	"compensation_awarded" numeric(12, 2),
	"union_rep_id" uuid,
	"union_rep_name" varchar(255),
	"document_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
COMMENT ON TABLE public."cnesst_filings" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cnesst_filings" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cnesst_filings" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cnesst_filings" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."joint_hs_committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workplace_id" uuid,
	"workplace_name" varchar(255) NOT NULL,
	"committee_name" varchar(255) NOT NULL,
	"established_date" date NOT NULL,
	"mandate_expiry_date" date,
	"worker_representatives" jsonb,
	"employer_representatives" jsonb,
	"worker_co_chair_id" uuid,
	"worker_co_chair_name" varchar(255),
	"employer_co_chair_name" varchar(255),
	"meeting_frequency" varchar(50),
	"last_meeting_date" date,
	"next_meeting_date" date,
	"total_meetings_held" integer DEFAULT 0,
	"prevention_program_approved" boolean DEFAULT false,
	"prevention_program_date" date,
	"health_program_approved" boolean DEFAULT false,
	"health_program_date" date,
	"workplace_worker_count" integer,
	"is_mandatory" boolean,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"document_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."joint_hs_committees" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."joint_hs_committees" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."joint_hs_committees" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."joint_hs_committees" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."pay_equity_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"status" "pay_equity_status" DEFAULT 'not_started' NOT NULL,
	"committee_formed" boolean DEFAULT false,
	"committee_formation_date" date,
	"worker_members" jsonb,
	"employer_members" jsonb,
	"male_job_classes" integer,
	"female_job_classes" integer,
	"mixed_job_classes" integer,
	"evaluation_method" varchar(100),
	"results_posted_date" date,
	"contest_deadline" date,
	"total_adjustment_amount" numeric(14, 2),
	"adjustments_paid_date" date,
	"maintenance_evaluation_date" date,
	"next_maintenance_due" date,
	"cnesst_declaration_filed" boolean DEFAULT false,
	"cnesst_declaration_date" date,
	"notes" text,
	"document_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."pay_equity_exercises" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."pay_equity_exercises" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."pay_equity_exercises" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."pay_equity_exercises" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."preventive_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cnesst_filing_id" uuid,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"reason" "preventive_withdrawal_reason" NOT NULL,
	"request_date" date NOT NULL,
	"medical_certificate_date" date,
	"physician_name" varchar(255),
	"reassignment_offered" boolean DEFAULT false,
	"reassignment_accepted" boolean,
	"reassignment_description" text,
	"withdrawal_start_date" date,
	"withdrawal_end_date" date,
	"employer_paid_days" integer,
	"cnesst_irr_start_date" date,
	"cnesst_irr_weekly_amount" numeric(10, 2),
	"status" "cnesst_filing_status" DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"document_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."preventive_withdrawals" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."preventive_withdrawals" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."preventive_withdrawals" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."preventive_withdrawals" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."right_of_refusal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cnesst_filing_id" uuid,
	"incident_id" uuid,
	"member_id" uuid NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"job_title" varchar(255),
	"refusal_date" timestamp with time zone NOT NULL,
	"workplace_id" uuid,
	"workplace_name" varchar(255),
	"location_description" text,
	"task_refused" text NOT NULL,
	"danger_description" text NOT NULL,
	"supervisor_notified_at" timestamp with time zone,
	"supervisor_name" varchar(255),
	"hs_rep_notified_at" timestamp with time zone,
	"hs_rep_name" varchar(255),
	"cnesst_inspector_called_at" timestamp with time zone,
	"cnesst_inspector_name" varchar(255),
	"inspector_decision_date" date,
	"outcome" "right_of_refusal_outcome",
	"outcome_notes" text,
	"corrective_actions_required" boolean DEFAULT false,
	"corrective_actions_summary" text,
	"reprisal_complaint" boolean DEFAULT false,
	"reprisal_details" text,
	"document_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."right_of_refusal_events" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."right_of_refusal_events" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."right_of_refusal_events" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."right_of_refusal_events" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."wcb_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"jurisdiction" "wcb_jurisdiction" NOT NULL,
	"claim_type" "wcb_claim_type" NOT NULL,
	"status" "wcb_claim_status" DEFAULT 'draft' NOT NULL,
	"board_claim_number" varchar(100),
	"employer_report_number" varchar(100),
	"incident_date" date NOT NULL,
	"reported_date" date,
	"filed_date" date,
	"description" text NOT NULL,
	"body_part_affected" varchar(255),
	"injury_nature" varchar(255),
	"work_location" varchar(500),
	"witness_names" jsonb,
	"hospital_name" varchar(500),
	"treating_physician" varchar(255),
	"initial_prognosis" text,
	"estimated_recovery_days" integer,
	"days_lost" integer DEFAULT 0,
	"return_to_work_status" "wcb_return_to_work_status" DEFAULT 'not_applicable',
	"return_to_work_date" date,
	"modified_duties_description" text,
	"wage_replacement_rate" numeric(5, 4),
	"total_benefits_paid" numeric(12, 2),
	"union_rep_id" uuid,
	"union_involved" boolean DEFAULT false,
	"grievance_filed" boolean DEFAULT false,
	"grievance_id" uuid,
	"appeal_deadline" date,
	"appeal_filed_date" date,
	"appeal_outcome" varchar(100),
	"document_ids" jsonb,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
COMMENT ON TABLE public."wcb_claims" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."wcb_claims" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."wcb_claims" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."wcb_claims" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."wcb_employer_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"jurisdiction" "wcb_jurisdiction" NOT NULL,
	"assessment_year" integer NOT NULL,
	"rate_group" varchar(100),
	"premium_rate" numeric(8, 6),
	"assessable_payroll" numeric(14, 2),
	"premium_due" numeric(12, 2),
	"experience_rating" numeric(8, 4),
	"rating_program_name" varchar(255),
	"surcharge_or_refund" numeric(12, 2),
	"due_date" date,
	"paid_date" date,
	"status" varchar(50) DEFAULT 'pending',
	"document_ids" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
COMMENT ON TABLE public."wcb_employer_assessments" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."wcb_employer_assessments" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."wcb_employer_assessments" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."wcb_employer_assessments" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."member_dues_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"issue_type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"payroll_deduction_id" uuid,
	"pay_period_start" timestamp,
	"pay_period_end" timestamp,
	"expected_amount" numeric(10, 2),
	"actual_amount" numeric(10, 2),
	"status" text DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 3,
	"assigned_to" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_type" text,
	"resolution_notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."member_dues_issues" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."member_dues_issues" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."member_dues_issues" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."member_dues_issues" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."payroll_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"employer_id" uuid NOT NULL,
	"pay_period_start" timestamp NOT NULL,
	"pay_period_end" timestamp NOT NULL,
	"gross_pay" numeric(12, 2),
	"net_pay" numeric(12, 2),
	"union_dues_amount" numeric(10, 2) NOT NULL,
	"other_deductions" jsonb,
	"source" text DEFAULT 'remittance' NOT NULL,
	"remittance_line_item_id" uuid,
	"verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"verified_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."payroll_deductions" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."payroll_deductions" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."payroll_deductions" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."payroll_deductions" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."customer_nps_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"respondent_name" varchar(255) NOT NULL,
	"score" integer NOT NULL,
	"feedback" text,
	"category" varchar(100),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."customer_nps_surveys" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."customer_nps_surveys" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."customer_nps_surveys" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."customer_nps_surveys" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."customer_onboarding_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"milestone" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."customer_onboarding_milestones" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."customer_onboarding_milestones" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."customer_onboarding_milestones" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."customer_onboarding_milestones" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(300) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_fr" varchar(300),
	"description" text,
	"source_type" "cba_intel_source_type" NOT NULL,
	"format_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"collection_method" "cba_intel_collection_method" NOT NULL,
	"trust_tier" "cba_intel_trust_tier" DEFAULT 'unverified' NOT NULL,
	"jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sectors" jsonb DEFAULT '[]'::jsonb,
	"base_url" text NOT NULL,
	"api_endpoint" text,
	"feed_url" text,
	"update_cadence" varchar(60),
	"expected_update_days" integer,
	"health_status" "cba_intel_source_health" DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"robots_notes" text,
	"terms_url" text,
	"redistribution_notes" text,
	"provenance_rules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"adapter_key" varchar(120),
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cba_intel_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_sources" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_sources" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_sources" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_sources" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "cba_intel_ingestion_status" DEFAULT 'queued' NOT NULL,
	"failure_class" "cba_intel_failure_class",
	"documents_found" integer DEFAULT 0,
	"documents_new" integer DEFAULT 0,
	"documents_updated" integer DEFAULT 0,
	"documents_unchanged" integer DEFAULT 0,
	"documents_failed" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"trigger_type" varchar(30) DEFAULT 'scheduled' NOT NULL,
	"triggered_by" varchar(255),
	"adapter_version" varchar(60),
	"error_message" text,
	"error_details" jsonb,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"parent_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_ingestion_jobs" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_ingestion_jobs" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_ingestion_jobs" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_ingestion_jobs" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_doc_id" varchar(255),
	"title" varchar(500),
	"document_type" "cba_intel_doc_type" NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"raw_content" text,
	"normalized_text" text,
	"parsed_metadata" jsonb,
	"content_hash" varchar(64) NOT NULL,
	"processing_status" "cba_intel_doc_processing_status" DEFAULT 'fetched' NOT NULL,
	"page_count" integer,
	"word_count" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" uuid,
	"is_latest" boolean DEFAULT true NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"ingestion_job_id" uuid,
	"jurisdiction" varchar(40),
	"sector" varchar(200),
	"is_summary_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_documents" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_documents" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_documents" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_documents" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"extraction_run_id" uuid,
	"title" varchar(500) NOT NULL,
	"employer_normalized" varchar(300) NOT NULL,
	"union_normalized" varchar(300) NOT NULL,
	"local_entity" varchar(200),
	"bargaining_unit_description" text,
	"jurisdiction" varchar(40) NOT NULL,
	"sector" varchar(200),
	"effective_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"ratification_date" timestamp with time zone,
	"term_months" integer,
	"employee_coverage" integer,
	"is_summary_only" boolean DEFAULT false NOT NULL,
	"has_full_text" boolean DEFAULT false NOT NULL,
	"extraction_status" varchar(30) DEFAULT 'extracted' NOT NULL,
	"review_status" varchar(30) DEFAULT 'pending_review' NOT NULL,
	"overall_confidence" numeric(4, 3) NOT NULL,
	"source_id" uuid,
	"source_url" text,
	"content_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_agreements" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_agreements" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_agreements" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_agreements" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"finding_id" uuid,
	"clause_family" "cba_intel_clause_family" NOT NULL,
	"clause_number" varchar(50),
	"title" varchar(500),
	"summary" text,
	"raw_text" text,
	"confidence" numeric(4, 3) NOT NULL,
	"is_inferred" boolean DEFAULT false NOT NULL,
	"content_hash" varchar(64),
	"review_status" varchar(30) DEFAULT 'pending_review',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_clauses" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_clauses" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_clauses" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_clauses" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"extraction_method" "cba_intel_extraction_method" NOT NULL,
	"model_version" varchar(60),
	"prompt_version" varchar(60),
	"status" "cba_intel_extraction_status" DEFAULT 'pending' NOT NULL,
	"findings_count" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"errors" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"triggered_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_extraction_runs" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_extraction_runs" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_extraction_runs" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_extraction_runs" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"finding_type" varchar(60) NOT NULL,
	"clause_family" "cba_intel_clause_family",
	"label" varchar(300) NOT NULL,
	"value" text,
	"value_structured" jsonb,
	"source_span_start" integer,
	"source_span_end" integer,
	"source_section" varchar(200),
	"source_page_number" integer,
	"citation_text" text,
	"confidence" numeric(4, 3) NOT NULL,
	"is_inferred" boolean DEFAULT false NOT NULL,
	"extraction_method" "cba_intel_extraction_method" NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"review_status" varchar(30) DEFAULT 'pending_review',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_findings" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_findings" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_findings" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_findings" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_wage_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"finding_id" uuid,
	"effective_date" timestamp with time zone,
	"year" integer,
	"adjustment_type" varchar(60) NOT NULL,
	"adjustment_percent" numeric(6, 3),
	"adjustment_flat" numeric(12, 2),
	"description" text,
	"classification" varchar(200),
	"step" integer,
	"confidence" numeric(4, 3) NOT NULL,
	"is_inferred" boolean DEFAULT false NOT NULL,
	"citation_text" text,
	"review_status" varchar(30) DEFAULT 'pending_review',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_wage_adjustments" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_wage_adjustments" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_wage_adjustments" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_wage_adjustments" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "cba_intel_review_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"decision" "cba_intel_review_status" NOT NULL,
	"reason" text,
	"comment" text,
	"reviewer_id" varchar(255) NOT NULL,
	"reviewer_role" varchar(60) NOT NULL,
	"previous_status" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_review_decisions" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_review_decisions" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_review_decisions" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_review_decisions" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_benchmark_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_agreement_id" uuid NOT NULL,
	"filter_jurisdiction" varchar(40),
	"filter_sector" varchar(200),
	"filter_union" varchar(300),
	"filter_employer_class" varchar(200),
	"comparable_count" integer NOT NULL,
	"comparables" jsonb NOT NULL,
	"median_wage_increase" numeric(6, 3),
	"avg_term_months" numeric(6, 1),
	"clause_family_coverage" jsonb,
	"target_wage_increase" numeric(6, 3),
	"target_term_months" integer,
	"wage_percentile" numeric(5, 2),
	"snapshot_version" integer DEFAULT 1 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"computed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_benchmark_snapshots" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_benchmark_snapshots" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_benchmark_snapshots" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_benchmark_snapshots" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."cba_intel_freshness_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"freshness_status" "cba_intel_freshness_status" NOT NULL,
	"days_since_last_success" integer,
	"document_count" integer,
	"stale_document_count" integer,
	"notes" text
);
--> statement-breakpoint
COMMENT ON TABLE public."cba_intel_freshness_log" IS 'platform-migration:declared-absent-relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."cba_intel_freshness_log" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_freshness_log" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."cba_intel_freshness_log" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
ALTER TABLE public."customer_nps_surveys" ADD CONSTRAINT "customer_nps_surveys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."customer_onboarding_milestones" ADD CONSTRAINT "customer_onboarding_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_ingestion_jobs" ADD CONSTRAINT "cba_intel_ingestion_jobs_source_id_cba_intel_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."cba_intel_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_documents" ADD CONSTRAINT "cba_intel_documents_source_id_cba_intel_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."cba_intel_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_agreements" ADD CONSTRAINT "cba_intel_agreements_document_id_cba_intel_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."cba_intel_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_agreements" ADD CONSTRAINT "cba_intel_agreements_extraction_run_id_cba_intel_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."cba_intel_extraction_runs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_agreements" ADD CONSTRAINT "cba_intel_agreements_source_id_cba_intel_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."cba_intel_sources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_clauses" ADD CONSTRAINT "cba_intel_clauses_agreement_id_cba_intel_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."cba_intel_agreements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_clauses" ADD CONSTRAINT "cba_intel_clauses_finding_id_cba_intel_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."cba_intel_findings"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_extraction_runs" ADD CONSTRAINT "cba_intel_extraction_runs_document_id_cba_intel_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."cba_intel_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_findings" ADD CONSTRAINT "cba_intel_findings_extraction_run_id_cba_intel_extraction_runs_id_fk" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."cba_intel_extraction_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_findings" ADD CONSTRAINT "cba_intel_findings_document_id_cba_intel_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."cba_intel_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_wage_adjustments" ADD CONSTRAINT "cba_intel_wage_adjustments_agreement_id_cba_intel_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."cba_intel_agreements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_wage_adjustments" ADD CONSTRAINT "cba_intel_wage_adjustments_finding_id_cba_intel_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."cba_intel_findings"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_benchmark_snapshots" ADD CONSTRAINT "cba_intel_benchmark_snapshots_target_agreement_id_cba_intel_agreements_id_fk" FOREIGN KEY ("target_agreement_id") REFERENCES "public"."cba_intel_agreements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."cba_intel_freshness_log" ADD CONSTRAINT "cba_intel_freshness_log_source_id_cba_intel_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."cba_intel_sources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_anti_scab_org" ON public."anti_scab_violations" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_anti_scab_date" ON public."anti_scab_violations" USING btree ("violation_date");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_org" ON public."cnesst_filings" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_type" ON public."cnesst_filings" USING btree ("filing_type");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_status" ON public."cnesst_filings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_member" ON public."cnesst_filings" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_incident" ON public."cnesst_filings" USING btree ("incident_id");
--> statement-breakpoint
CREATE INDEX "idx_cnesst_filings_org_date" ON public."cnesst_filings" USING btree ("organization_id","filed_date");
--> statement-breakpoint
CREATE INDEX "idx_hs_committee_org" ON public."joint_hs_committees" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_hs_committee_workplace" ON public."joint_hs_committees" USING btree ("workplace_id");
--> statement-breakpoint
CREATE INDEX "idx_hs_committee_active" ON public."joint_hs_committees" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "idx_pay_equity_org" ON public."pay_equity_exercises" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_pay_equity_status" ON public."pay_equity_exercises" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_withdrawal_org" ON public."preventive_withdrawals" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_withdrawal_member" ON public."preventive_withdrawals" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "idx_refusal_org" ON public."right_of_refusal_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_refusal_member" ON public."right_of_refusal_events" USING btree ("member_id");
--> statement-breakpoint
CREATE INDEX "idx_refusal_date" ON public."right_of_refusal_events" USING btree ("refusal_date");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_org" ON public."wcb_claims" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_worker" ON public."wcb_claims" USING btree ("worker_id");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_jurisdiction" ON public."wcb_claims" USING btree ("jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_status" ON public."wcb_claims" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_incident_date" ON public."wcb_claims" USING btree ("incident_date");
--> statement-breakpoint
CREATE INDEX "idx_wcb_claims_org_jurisdiction" ON public."wcb_claims" USING btree ("organization_id","jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_wcb_assessments_org" ON public."wcb_employer_assessments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "idx_wcb_assessments_jurisdiction" ON public."wcb_employer_assessments" USING btree ("jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_wcb_assessments_year" ON public."wcb_employer_assessments" USING btree ("assessment_year");
--> statement-breakpoint
CREATE INDEX "idx_wcb_assessments_org_juris_year" ON public."wcb_employer_assessments" USING btree ("organization_id","jurisdiction","assessment_year");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_sources_type" ON public."cba_intel_sources" USING btree ("source_type");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_sources_health" ON public."cba_intel_sources" USING btree ("health_status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_sources_active" ON public."cba_intel_sources" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_jobs_source" ON public."cba_intel_ingestion_jobs" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_jobs_status" ON public."cba_intel_ingestion_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_jobs_created" ON public."cba_intel_ingestion_jobs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_source" ON public."cba_intel_documents" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_hash" ON public."cba_intel_documents" USING btree ("content_hash");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_status" ON public."cba_intel_documents" USING btree ("processing_status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_jurisdiction" ON public."cba_intel_documents" USING btree ("jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_type" ON public."cba_intel_documents" USING btree ("document_type");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_docs_latest" ON public."cba_intel_documents" USING btree ("is_latest");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_doc" ON public."cba_intel_agreements" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_jurisdiction" ON public."cba_intel_agreements" USING btree ("jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_employer" ON public."cba_intel_agreements" USING btree ("employer_normalized");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_union" ON public."cba_intel_agreements" USING btree ("union_normalized");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_expiry" ON public."cba_intel_agreements" USING btree ("expiry_date");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_agreements_review" ON public."cba_intel_agreements" USING btree ("review_status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_clauses_agreement" ON public."cba_intel_clauses" USING btree ("agreement_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_clauses_family" ON public."cba_intel_clauses" USING btree ("clause_family");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_clauses_review" ON public."cba_intel_clauses" USING btree ("review_status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_runs_doc" ON public."cba_intel_extraction_runs" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_runs_status" ON public."cba_intel_extraction_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_run" ON public."cba_intel_findings" USING btree ("extraction_run_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_doc" ON public."cba_intel_findings" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_type" ON public."cba_intel_findings" USING btree ("finding_type");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_family" ON public."cba_intel_findings" USING btree ("clause_family");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_hash" ON public."cba_intel_findings" USING btree ("content_hash");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_findings_review" ON public."cba_intel_findings" USING btree ("review_status");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_wages_agreement" ON public."cba_intel_wage_adjustments" USING btree ("agreement_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_wages_year" ON public."cba_intel_wage_adjustments" USING btree ("year");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_wages_type" ON public."cba_intel_wage_adjustments" USING btree ("adjustment_type");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_reviews_target" ON public."cba_intel_review_decisions" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_reviews_decision" ON public."cba_intel_review_decisions" USING btree ("decision");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_reviews_reviewer" ON public."cba_intel_review_decisions" USING btree ("reviewer_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_reviews_created" ON public."cba_intel_review_decisions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_bench_target" ON public."cba_intel_benchmark_snapshots" USING btree ("target_agreement_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_bench_computed" ON public."cba_intel_benchmark_snapshots" USING btree ("computed_at");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_bench_jurisdiction" ON public."cba_intel_benchmark_snapshots" USING btree ("filter_jurisdiction");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_freshness_source" ON public."cba_intel_freshness_log" USING btree ("source_id");
--> statement-breakpoint
CREATE INDEX "idx_cba_intel_freshness_checked" ON public."cba_intel_freshness_log" USING btree ("checked_at");
--> statement-breakpoint
DO $ue_post$
DECLARE
  wrong text[];
BEGIN
  SELECT array_agg(e.t ORDER BY e.t) INTO wrong
  FROM (VALUES ('anti_scab_violations', 28), ('cnesst_filings', 29), ('joint_hs_committees', 27), ('pay_equity_exercises', 24), ('preventive_withdrawals', 22), ('right_of_refusal_events', 30), ('wcb_claims', 39), ('wcb_employer_assessments', 19), ('member_dues_issues', 21), ('payroll_deductions', 18), ('customer_nps_surveys', 7), ('customer_onboarding_milestones', 7), ('cba_intel_sources', 30), ('cba_intel_ingestion_jobs', 21), ('cba_intel_documents', 26), ('cba_intel_agreements', 25), ('cba_intel_clauses', 13), ('cba_intel_extraction_runs', 14), ('cba_intel_findings', 19), ('cba_intel_wage_adjustments', 16), ('cba_intel_review_decisions', 10), ('cba_intel_benchmark_snapshots', 18), ('cba_intel_freshness_log', 8)) AS e(t, n)
  WHERE (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = e.t) <> e.n
     OR obj_description(to_regclass('public.' || e.t), 'pg_class') IS DISTINCT FROM 'platform-migration:declared-absent-relations';
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations postflight: relations without the declared column count or tag: %', wrong;
  END IF;
  SELECT array_agg(t ORDER BY t) INTO wrong
  FROM unnest(ARRAY['anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals', 'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions', 'customer_nps_surveys', 'customer_onboarding_milestones', 'cba_intel_sources', 'cba_intel_ingestion_jobs', 'cba_intel_documents', 'cba_intel_agreements', 'cba_intel_clauses', 'cba_intel_extraction_runs', 'cba_intel_findings', 'cba_intel_wage_adjustments', 'cba_intel_review_decisions', 'cba_intel_benchmark_snapshots', 'cba_intel_freshness_log']) AS t
  WHERE (to_regrole('union_eyes_runtime') IS NOT NULL AND (has_table_privilege('union_eyes_runtime', 'public.' || t, 'SELECT') OR has_table_privilege('union_eyes_runtime', 'public.' || t, 'INSERT')
        OR has_table_privilege('union_eyes_runtime', 'public.' || t, 'UPDATE') OR has_table_privilege('union_eyes_runtime', 'public.' || t, 'DELETE')))
     OR (to_regrole('union_eyes_system') IS NOT NULL AND (has_table_privilege('union_eyes_system', 'public.' || t, 'SELECT') OR has_table_privilege('union_eyes_system', 'public.' || t, 'INSERT')
        OR has_table_privilege('union_eyes_system', 'public.' || t, 'UPDATE') OR has_table_privilege('union_eyes_system', 'public.' || t, 'DELETE')));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations postflight: relations already carry runtime or system privileges before the manifest grants them: %', wrong;
  END IF;
END $ue_post$;
