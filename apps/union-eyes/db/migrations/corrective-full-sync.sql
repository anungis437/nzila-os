-- ==============================================
-- CORRECTIVE MIGRATION: Full Schema Sync
-- Generated: 2026-03-25T13:06:54.036Z
-- Missing tables: 149
-- Tables with missing columns: 199
-- ==============================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS "user_management";

-- ── ENUM TYPES ──
DO $$ BEGIN CREATE TYPE "account_type" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods_sold', 'other_income', 'other_expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "account_status" AS ENUM ('active', 'inactive', 'archived', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "corrective_action_priority" AS ENUM ('immediate', 'urgent', 'high', 'normal', 'low'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "corrective_action_status" AS ENUM ('open', 'assigned', 'in_progress', 'pending_verification', 'verified', 'closed', 'deferred', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "hazard_category" AS ENUM ('biological', 'chemical', 'ergonomic', 'physical', 'psychosocial', 'safety', 'environmental', 'electrical', 'fire', 'confined_space', 'working_at_heights', 'machinery', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "hazard_level" AS ENUM ('low', 'moderate', 'high', 'critical', 'extreme'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "incident_severity" AS ENUM ('near_miss', 'minor', 'moderate', 'serious', 'critical', 'fatal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ppe_type" AS ENUM ('hard_hat', 'safety_glasses', 'face_shield', 'hearing_protection', 'respirator', 'dust_mask', 'safety_gloves', 'chemical_gloves', 'safety_boots', 'high_vis_vest', 'fall_protection', 'welding_helmet', 'protective_clothing', 'coveralls', 'apron', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ppe_status" AS ENUM ('in_stock', 'issued', 'in_use', 'returned', 'damaged', 'expired', 'disposed', 'under_inspection'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "safety_certification_type" AS ENUM ('health_safety_rep', 'first_aid', 'confined_space', 'fall_protection', 'forklift', 'whmis', 'lockout_tagout', 'fire_safety', 'emergency_response', 'scaffolding', 'crane_rigging', 'hazmat', 'radiation_safety', 'asbestos_awareness', 'silica_awareness', 'workplace_violence', 'accident_investigation', 'safety_auditor', 'ergonomics', 'occupational_hygiene', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "certification_status" AS ENUM ('active', 'expired', 'suspended', 'revoked', 'pending_renewal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "meeting_type" AS ENUM ('regular', 'special', 'inspection', 'incident_review', 'training', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "inspection_type" AS ENUM ('routine', 'comprehensive', 'targeted', 'post_incident', 'regulatory', 'pre_operational', 'contractor', 'joint_committee', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "inspection_status" AS ENUM ('scheduled', 'in_progress', 'completed', 'requires_followup', 'followup_complete', 'cancelled', 'overdue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "training_status" AS ENUM ('scheduled', 'in_progress', 'completed', 'failed', 'expired', 'renewed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "incident_type" AS ENUM ('injury', 'near_miss', 'property_damage', 'environmental', 'vehicle', 'ergonomic', 'exposure', 'occupational_illness', 'fire', 'electrical', 'fall', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "body_part" AS ENUM ('head', 'eyes', 'face', 'neck', 'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'fingers', 'chest', 'back', 'abdomen', 'hip', 'leg', 'knee', 'ankle', 'foot', 'toes', 'multiple', 'internal', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "injury_nature" AS ENUM ('cut', 'laceration', 'puncture', 'bruise', 'contusion', 'fracture', 'sprain', 'strain', 'dislocation', 'amputation', 'burn', 'chemical_burn', 'concussion', 'crushing', 'electric_shock', 'exposure', 'hearing_loss', 'infection', 'inflammation', 'poisoning', 'respiratory', 'multiple', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "document_version_status" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'superseded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "visibility_scope" AS ENUM ('member', 'staff', 'admin', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "delivery_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "extension_status" AS ENUM ('pending', 'approved', 'denied', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "assignment_role" AS ENUM ('primary_officer', 'secondary_officer', 'legal_counsel', 'external_arbitrator', 'management_rep', 'witness', 'observer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "assignment_status" AS ENUM ('assigned', 'accepted', 'in_progress', 'completed', 'reassigned', 'declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "settlement_status" AS ENUM ('proposed', 'under_review', 'accepted', 'rejected', 'finalized'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "grievance_stage_type" AS ENUM ('filed', 'intake', 'investigation', 'step_1', 'step_2', 'step_3', 'mediation', 'pre_arbitration', 'arbitration', 'resolved', 'withdrawn', 'denied', 'settled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "grievance_workflow_status" AS ENUM ('active', 'draft', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "grievance_event_type" AS ENUM ('created', 'status_changed', 'assigned', 'reassigned', 'note_added', 'document_uploaded', 'escalated', 'deadline_set', 'deadline_extended', 'meeting_scheduled', 'response_received', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "payment_processor" AS ENUM ('stripe', 'whop', 'paypal', 'square', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "reconciliation_status" AS ENUM ('unreconciled', 'pending_review', 'reconciled', 'orphaned', 'disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "payment_method" AS ENUM ('stripe', 'bank_transfer', 'check', 'cash', 'direct_debit', 'payroll_deduction', 'ewallet'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "payment_type" AS ENUM ('dues', 'strike_fund', 'subscription', 'stipend', 'honorarium', 'rebate', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "payment_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed', 'unmatched', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "cost_center_type" AS ENUM ('department', 'project', 'location', 'program', 'fund', 'grant', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "strategic_goal_category" AS ENUM ('membership', 'financial', 'advocacy', 'operations', 'education', 'organizing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "strategic_goal_status" AS ENUM ('on-track', 'at-risk', 'delayed', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "message_type" AS ENUM ('text', 'file', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "message_status" AS ENUM ('sent', 'delivered', 'read'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_bounce_type" AS ENUM ('permanent', 'temporary', 'complaint', 'manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_channel" AS ENUM ('email', 'sms', 'push', 'in-app', 'multi'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_status" AS ENUM ('sent', 'failed', 'partial', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_queue_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_priority" AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_template_type" AS ENUM ('payment', 'dues', 'strike', 'voting', 'certification', 'general', 'system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_template_status" AS ENUM ('active', 'inactive', 'draft', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "notification_schedule_status" AS ENUM ('scheduled', 'sent', 'cancelled', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "digest_frequency" AS ENUM ('immediate', 'daily', 'weekly', 'never'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "push_delivery_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'clicked', 'dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "push_platform" AS ENUM ('ios', 'android', 'web'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "push_priority" AS ENUM ('low', 'normal', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "push_notification_status" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "campaign_type" AS ENUM ('broadcast', 'sequence', 'triggered', 'transactional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "campaign_channel" AS ENUM ('email', 'sms', 'push', 'multi_channel'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "campaign_status" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "message_delivery_status" AS ENUM ('queued', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked', 'unsubscribed', 'complained'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "field_note_type" AS ENUM ('contact', 'grievance', 'organizing', 'meeting', 'personal', 'workplace', 'follow_up'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "sentiment" AS ENUM ('positive', 'neutral', 'negative', 'concerned', 'engaged', 'disengaged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "task_status" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "outreach_sequence_status" AS ENUM ('active', 'paused', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "outreach_step_status" AS ENUM ('pending', 'scheduled', 'sent', 'delivered', 'completed', 'skipped', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "communication_template_category" AS ENUM ('initial_notification', 'request_response', 'request_documentation', 'meeting_request', 'resolution_proposal', 'escalation_notice', 'general'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "employer_communication_type" AS ENUM ('email', 'phone', 'meeting', 'letter', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "employer_communication_status" AS ENUM ('draft', 'sent', 'received', 'acknowledged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "employer_contact_role" AS ENUM ('main', 'hr', 'labour_relations', 'legal', 'supervisor', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "calendar_permission" AS ENUM ('owner', 'editor', 'viewer', 'none'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "processing_purpose" AS ENUM ('service_delivery', 'legal_compliance', 'contract_performance', 'legitimate_interest', 'consent', 'vital_interest'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "gdpr_request_type" AS ENUM ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "gdpr_request_status" AS ENUM ('pending', 'in_progress', 'completed', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "consent_type" AS ENUM ('essential', 'functional', 'analytics', 'marketing', 'personalization', 'third_party'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pci_scan_status" AS ENUM ('pass', 'fail', 'pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pci_requirement_status" AS ENUM ('compliant', 'not_applicable', 'requires_remediation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pci_assessment_status" AS ENUM ('in_progress', 'completed', 'requires_remediation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "external_hris_provider" AS ENUM ('WORKDAY', 'BAMBOOHR', 'ADP', 'CERIDIAN', 'UKG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pension_provider" AS ENUM ('OTPP', 'CPP_QPP', 'OMERS', 'HOOPP', 'LAPP', 'PSPP', 'BCMPP', 'SHEPP', 'CSSB', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pension_contribution_type" AS ENUM ('employee_regular', 'employer_regular', 'employee_voluntary', 'employee_buyback', 'transfer_in', 'adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pension_member_status" AS ENUM ('active', 'deferred', 'retired', 'disabled', 'terminated', 'deceased', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "pension_plan_type" AS ENUM ('defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit', 'multi_employer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "calendar_provider" AS ENUM ('OUTLOOK', 'GOOGLE', 'APPLE', 'CALDAV', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "attendee_response" AS ENUM ('accepted', 'declined', 'tentative', 'needs_action', 'delegated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "calendar_event_type" AS ENUM ('meeting', 'bargaining_session', 'grievance_hearing', 'arbitration', 'steward_training', 'membership_meeting', 'strike_vote', 'ratification_vote', 'executive_board', 'committee', 'social_event', 'deadline', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "calendar_event_status" AS ENUM ('confirmed', 'tentative', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "alert_action_type" AS ENUM ('send_email', 'send_sms', 'send_push_notification', 'create_task', 'update_record', 'trigger_webhook', 'escalate', 'run_script', 'send_slack_message'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "alert_condition_operator" AS ENUM ('equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null', 'between', 'regex_match'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "escalation_status" AS ENUM ('pending', 'in_progress', 'escalated', 'resolved', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "workflow_trigger_type" AS ENUM ('manual', 'schedule', 'record_created', 'record_updated', 'record_deleted', 'field_changed', 'status_changed', 'deadline_approaching', 'webhook'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "workflow_execution_status" AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "erp_system" AS ENUM ('quickbooks_online', 'sage_intacct', 'xero', 'sap_business_one', 'microsoft_dynamics', 'oracle_netsuite', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "audit_action" AS ENUM ('create', 'update', 'delete', 'sync', 'approve', 'reject', 'void', 'reverse'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "sync_direction" AS ENUM ('push', 'pull', 'bidirectional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "social_platform" AS ENUM ('facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "social_account_status" AS ENUM ('active', 'expired', 'disconnected', 'rate_limited', 'suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "campaign_status" AS ENUM ('planning', 'active', 'paused', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "engagement_type" AS ENUM ('like', 'comment', 'share', 'retweet', 'reply', 'reaction', 'mention', 'tag'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "social_post_type" AS ENUM ('text', 'image', 'video', 'link', 'carousel', 'story', 'reel'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "social_post_status" AS ENUM ('draft', 'scheduled', 'published', 'failed', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ticket_source" AS ENUM ('email', 'web_form', 'phone', 'chat', 'internal', 'api'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "federation_campaign_type" AS ENUM ('organizing', 'political', 'legislative', 'public_awareness', 'solidarity', 'strike_support', 'health_safety', 'equity'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "federation_communication_type" AS ENUM ('announcement', 'alert', 'newsletter', 'bulletin', 'press_release', 'internal_memo', 'survey', 'event_notice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "federation_meeting_type" AS ENUM ('convention', 'executive_meeting', 'general_meeting', 'committee_meeting', 'emergency_meeting', 'workshop', 'conference', 'webinar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "federation_membership_status" AS ENUM ('active', 'pending', 'suspended', 'withdrawn', 'expelled', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "federation_resource_type" AS ENUM ('template', 'toolkit', 'policy', 'training', 'research', 'best_practice', 'legal', 'organizing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── MISSING TABLES ──
-- user_sessions (12 columns)
CREATE TABLE IF NOT EXISTS "user_management"."user_sessions" (
  "session_id" uuid PRIMARY KEY,
  "user_id" varchar(255) NOT NULL,
  "organization_id" uuid,
  "session_token" text NOT NULL,
  "refresh_token" text,
  "device_info" jsonb,
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "last_used_at" timestamp with time zone
);

-- segment_executions (7 columns)
CREATE TABLE IF NOT EXISTS "segment_executions" (
  "id" uuid PRIMARY KEY,
  "segment_id" uuid NOT NULL,
  "executed_by" text NOT NULL,
  "executed_at" timestamp NOT NULL,
  "result_count" integer NOT NULL,
  "execution_time_ms" integer,
  "filters_snapshot" jsonb
);

-- segment_exports (17 columns)
CREATE TABLE IF NOT EXISTS "segment_exports" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "segment_id" uuid,
  "exported_by" text NOT NULL,
  "exported_at" timestamp NOT NULL,
  "format" text NOT NULL,
  "include_fields" jsonb,
  "member_count" integer NOT NULL,
  "filters_used" jsonb,
  "watermark" text,
  "export_hash" text,
  "purpose" text,
  "approved_by" text,
  "file_url" text,
  "file_size" integer,
  "data_retention_days" integer,
  "deleted_at" timestamp
);

-- member_addresses (13 columns)
CREATE TABLE IF NOT EXISTS "member_addresses" (
  "id" uuid PRIMARY KEY,
  "user_id" varchar(255) NOT NULL,
  "organization_id" uuid NOT NULL,
  "address_type" varchar(20) NOT NULL,
  "street_address" text NOT NULL,
  "city" varchar(100) NOT NULL,
  "province" varchar(2) NOT NULL,
  "postal_code" varchar(10) NOT NULL,
  "country" varchar(2) NOT NULL,
  "is_primary" boolean,
  "effective_date" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- grievance_events (6 columns)
CREATE TABLE IF NOT EXISTS "grievance_events" (
  "id" uuid PRIMARY KEY,
  "grievance_id" uuid NOT NULL,
  "event_type" grievance_event_type NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL
);

-- union_dues_receipts (42 columns)
CREATE TABLE IF NOT EXISTS "union_dues_receipts" (
  "id" uuid PRIMARY KEY,
  "user_id" varchar(255) NOT NULL,
  "organization_id" uuid NOT NULL,
  "tax_year" varchar(4) NOT NULL,
  "member_name" text NOT NULL,
  "member_sin" varchar(11),
  "member_address" text,
  "member_city" varchar(100),
  "member_province" varchar(2) NOT NULL,
  "member_postal_code" varchar(10),
  "union_name" text NOT NULL,
  "union_business_number" varchar(15) NOT NULL,
  "union_address" text NOT NULL,
  "union_city" varchar(100) NOT NULL,
  "union_province" varchar(2) NOT NULL,
  "union_postal_code" varchar(10) NOT NULL,
  "total_union_dues" numeric(10, 2) NOT NULL,
  "regular_dues" numeric(10, 2) NOT NULL,
  "special_assessments" numeric(10, 2) NOT NULL,
  "initiation_fees" numeric(10, 2) NOT NULL,
  "non_deductible_amount" numeric(10, 2) NOT NULL,
  "non_deductible_description" text,
  "cope_contributions" numeric(10, 2) NOT NULL,
  "collection_method" varchar(30) NOT NULL,
  "employer_deducted" boolean NOT NULL,
  "employer_name" text,
  "employer_business_number" varchar(15),
  "is_quebec_resident" boolean NOT NULL,
  "rl1_box_f_amount" numeric(10, 2),
  "receipt_number" varchar(50) NOT NULL,
  "generated_at" timestamp,
  "generated_by" varchar(255),
  "delivered_to_member" boolean NOT NULL,
  "delivery_method" varchar(50),
  "delivered_at" timestamp,
  "pdf_url" text,
  "is_amendment" boolean NOT NULL,
  "original_receipt_id" uuid,
  "amendment_reason" text,
  "status" varchar(20) NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- union_dues_year_end (17 columns)
CREATE TABLE IF NOT EXISTS "union_dues_year_end" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "tax_year" varchar(4) NOT NULL,
  "total_members" varchar(10) NOT NULL,
  "receipts_generated" varchar(10) NOT NULL,
  "receipts_delivered" varchar(10) NOT NULL,
  "total_dues_collected" numeric(12, 2) NOT NULL,
  "total_deductible_amount" numeric(12, 2) NOT NULL,
  "total_non_deductible_amount" numeric(12, 2) NOT NULL,
  "processing_started_at" timestamp,
  "processing_completed_at" timestamp,
  "delivery_deadline" timestamp NOT NULL,
  "status" varchar(20) NOT NULL,
  "processed_by" varchar(255),
  "notes" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- pension_benefit_claims (13 columns)
CREATE TABLE IF NOT EXISTS "pension_benefit_claims" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "member_name" varchar(255) NOT NULL,
  "claim_type" varchar(100) NOT NULL,
  "status" varchar(50) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "submitted_date" timestamp with time zone NOT NULL,
  "processed_date" timestamp with time zone,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_contributions (11 columns)
CREATE TABLE IF NOT EXISTS "pension_contributions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "member_name" varchar(255) NOT NULL,
  "period" varchar(20) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "payment_status" varchar(50) NOT NULL,
  "payment_date" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_members (13 columns)
CREATE TABLE IF NOT EXISTS "pension_members" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "user_id" uuid,
  "name" varchar(255) NOT NULL,
  "plan_name" varchar(255) NOT NULL,
  "enrollment_date" timestamp with time zone NOT NULL,
  "membership_status" varchar(50) NOT NULL,
  "years_of_service" numeric(5, 1) NOT NULL,
  "vesting_status" varchar(50) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_plans (12 columns)
CREATE TABLE IF NOT EXISTS "pension_plans" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "plan_name" varchar(255) NOT NULL,
  "plan_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL,
  "active_members" integer NOT NULL,
  "total_assets" numeric(15, 2) NOT NULL,
  "funding_status" numeric(5, 2) NOT NULL,
  "description" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_t4a_records (11 columns)
CREATE TABLE IF NOT EXISTS "pension_t4a_records" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "member_name" varchar(255) NOT NULL,
  "tax_year" integer NOT NULL,
  "pension_income" numeric(12, 2) NOT NULL,
  "status" varchar(50) NOT NULL,
  "generated_date" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_trustee_meetings (12 columns)
CREATE TABLE IF NOT EXISTS "pension_trustee_meetings" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "scheduled_date" timestamp with time zone NOT NULL,
  "location" varchar(255),
  "agenda" text,
  "minutes" text,
  "status" varchar(50) NOT NULL,
  "attendees" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pension_trustees (11 columns)
CREATE TABLE IF NOT EXISTS "pension_trustees" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "user_id" uuid,
  "name" varchar(255) NOT NULL,
  "role" varchar(100) NOT NULL,
  "appointed_date" timestamp with time zone NOT NULL,
  "term_end_date" timestamp with time zone,
  "status" varchar(50) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- billing_terms (9 columns)
CREATE TABLE IF NOT EXISTS "billing_terms" (
  "id" uuid PRIMARY KEY,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "due_days" integer NOT NULL,
  "discount_percent" numeric(5, 2),
  "discount_days" integer,
  "is_default" boolean NOT NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

-- voting_notifications (12 columns)
CREATE TABLE IF NOT EXISTS "voting_notifications" (
  "id" uuid PRIMARY KEY,
  "session_id" uuid NOT NULL,
  "type" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "recipient_id" uuid NOT NULL,
  "priority" varchar(20),
  "delivery_method" text[],
  "is_read" boolean,
  "sent_at" timestamp with time zone,
  "read_at" timestamp with time zone,
  "metadata" jsonb
);

-- strategic_goals (12 columns)
CREATE TABLE IF NOT EXISTS "strategic_goals" (
  "id" uuid PRIMARY KEY,
  "organization_id" varchar(255) NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" strategic_goal_category NOT NULL,
  "progress" integer NOT NULL,
  "due_date" timestamp with time zone,
  "owner" varchar(255),
  "status" strategic_goal_status NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- governance_signatories (13 columns)
CREATE TABLE IF NOT EXISTS "governance_signatories" (
  "id" uuid PRIMARY KEY,
  "organization_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "role" varchar(100) NOT NULL,
  "title" varchar(255) NOT NULL,
  "authority" varchar(50) NOT NULL,
  "active_from" timestamp with time zone NOT NULL,
  "active_to" timestamp with time zone,
  "status" varchar(20) NOT NULL,
  "documents" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- governance_policies (11 columns)
CREATE TABLE IF NOT EXISTS "governance_policies" (
  "id" uuid PRIMARY KEY,
  "organization_id" varchar(255) NOT NULL,
  "title" text NOT NULL,
  "category" varchar(50) NOT NULL,
  "description" text,
  "content" text,
  "status" varchar(20) NOT NULL,
  "updated_by" varchar(255),
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- poll_votes (9 columns)
CREATE TABLE IF NOT EXISTS "poll_votes" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "poll_id" uuid NOT NULL,
  "user_id" text,
  "voter_email" varchar(255),
  "option_id" varchar(50) NOT NULL,
  "ip_address" inet,
  "user_agent" text,
  "voted_at" timestamp with time zone NOT NULL
);

-- polls (16 columns)
CREATE TABLE IF NOT EXISTS "polls" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "question" text NOT NULL,
  "description" text,
  "options" jsonb NOT NULL,
  "status" varchar(50) NOT NULL,
  "allow_multiple_votes" boolean NOT NULL,
  "require_authentication" boolean NOT NULL,
  "show_results_before_vote" boolean NOT NULL,
  "published_at" timestamp with time zone NOT NULL,
  "closes_at" timestamp with time zone,
  "total_votes" integer NOT NULL,
  "unique_voters" integer NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- survey_answers (9 columns)
CREATE TABLE IF NOT EXISTS "survey_answers" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "response_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "answer_text" text,
  "answer_number" numeric(10, 2),
  "answer_choices" jsonb,
  "answer_other" text,
  "answered_at" timestamp with time zone NOT NULL
);

-- survey_questions (23 columns)
CREATE TABLE IF NOT EXISTS "survey_questions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "question_text" text NOT NULL,
  "question_type" varchar(50) NOT NULL,
  "description" text,
  "order_index" integer NOT NULL,
  "section" varchar(255),
  "required" boolean NOT NULL,
  "choices" jsonb,
  "allow_other" boolean NOT NULL,
  "min_choices" integer,
  "max_choices" integer,
  "rating_min" integer,
  "rating_max" integer,
  "rating_min_label" varchar(100),
  "rating_max_label" varchar(100),
  "min_length" integer,
  "max_length" integer,
  "placeholder" text,
  "show_if" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- survey_responses (14 columns)
CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "survey_id" uuid NOT NULL,
  "user_id" text,
  "respondent_email" varchar(255),
  "respondent_name" varchar(255),
  "status" varchar(50) NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "time_spent_seconds" integer,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- comparative_analyses (17 columns)
CREATE TABLE IF NOT EXISTS "comparative_analyses" (
  "id" uuid PRIMARY KEY,
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
  "is_public" boolean,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL
);

-- field_notes (21 columns)
CREATE TABLE IF NOT EXISTS "field_notes" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "author_id" varchar(255) NOT NULL,
  "note_type" field_note_type NOT NULL,
  "subject" varchar(255),
  "content" text NOT NULL,
  "sentiment" sentiment,
  "engagement_level" integer,
  "follow_up_date" date,
  "follow_up_completed" boolean,
  "follow_up_completed_at" timestamp with time zone,
  "related_case_id" uuid,
  "related_grievance_id" uuid,
  "interaction_date" date,
  "tags" text[],
  "is_private" boolean,
  "is_confidential" boolean,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- member_relationship_scores (20 columns)
CREATE TABLE IF NOT EXISTS "member_relationship_scores" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "overall_score" integer,
  "engagement_score" integer,
  "relationship_score" integer,
  "activity_score" integer,
  "last_contact_date" date,
  "total_interactions" integer,
  "interactions_last_30_days" integer,
  "field_notes_count" integer,
  "positive_notes_count" integer,
  "negative_notes_count" integer,
  "average_sentiment" varchar(50),
  "current_sentiment" sentiment,
  "is_at_risk" boolean,
  "at_risk_reason" text,
  "calculated_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- organizer_tasks (23 columns)
CREATE TABLE IF NOT EXISTS "organizer_tasks" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "assigned_to" varchar(255) NOT NULL,
  "assigned_by" varchar(255),
  "member_id" varchar(255),
  "related_case_id" uuid,
  "related_grievance_id" uuid,
  "priority" task_priority NOT NULL,
  "status" task_status NOT NULL,
  "due_date" date,
  "estimated_minutes" integer,
  "actual_minutes" integer,
  "completed_at" timestamp with time zone,
  "completion_notes" text,
  "blocked_reason" text,
  "metadata" jsonb,
  "tags" text[],
  "created_by" varchar(255) NOT NULL,
  "updated_by" varchar(255),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- outreach_enrollments (16 columns)
CREATE TABLE IF NOT EXISTS "outreach_enrollments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "sequence_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "enrolled_by" varchar(255),
  "current_step" integer,
  "total_steps" integer NOT NULL,
  "completed_steps" integer,
  "status" outreach_sequence_status NOT NULL,
  "enrolled_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "next_step_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- outreach_sequences (16 columns)
CREATE TABLE IF NOT EXISTS "outreach_sequences" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "trigger_type" varchar(50) NOT NULL,
  "trigger_conditions" jsonb,
  "steps" jsonb NOT NULL,
  "status" outreach_sequence_status NOT NULL,
  "is_active" boolean,
  "stats" jsonb,
  "metadata" jsonb,
  "tags" text[],
  "created_by" varchar(255) NOT NULL,
  "updated_by" varchar(255),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- outreach_steps_log (14 columns)
CREATE TABLE IF NOT EXISTS "outreach_steps_log" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "enrollment_id" uuid NOT NULL,
  "step_number" integer NOT NULL,
  "action_type" varchar(50) NOT NULL,
  "status" outreach_step_status NOT NULL,
  "scheduled_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  "message_log_id" uuid,
  "task_id" uuid,
  "error_message" text,
  "retry_count" integer,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL
);

-- task_comments (8 columns)
CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "author_id" varchar(255) NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- communication_templates (12 columns)
CREATE TABLE IF NOT EXISTS "communication_templates" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" communication_template_category NOT NULL,
  "subject" varchar(500) NOT NULL,
  "body" text NOT NULL,
  "variables" jsonb,
  "is_default" boolean,
  "is_active" boolean,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" uuid
);

-- employer_communications (20 columns)
CREATE TABLE IF NOT EXISTS "employer_communications" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "employer_id" uuid NOT NULL,
  "grievance_id" uuid,
  "type" employer_communication_type NOT NULL,
  "status" employer_communication_status NOT NULL,
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
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" uuid
);

-- employer_contacts (15 columns)
CREATE TABLE IF NOT EXISTS "employer_contacts" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "employer_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "role" employer_contact_role NOT NULL,
  "title" varchar(255),
  "email" varchar(320),
  "phone" varchar(30),
  "preferred_method" employer_communication_type,
  "is_primary" boolean,
  "is_active" boolean,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" uuid
);

-- member_documents (9 columns)
CREATE TABLE IF NOT EXISTS "member_documents" (
  "id" uuid PRIMARY KEY,
  "user_id" text NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" integer NOT NULL,
  "file_type" text NOT NULL,
  "category" text,
  "uploaded_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- signature_templates (18 columns)
CREATE TABLE IF NOT EXISTS "signature_templates" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "template_file_url" text NOT NULL,
  "template_file_name" text NOT NULL,
  "provider" signature_provider NOT NULL,
  "provider_template_id" text,
  "signature_fields" jsonb NOT NULL,
  "default_settings" jsonb,
  "signer_roles" jsonb NOT NULL,
  "is_active" boolean NOT NULL,
  "usage_count" integer NOT NULL,
  "last_used_at" timestamp,
  "created_by" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- signature_webhooks_log (14 columns)
CREATE TABLE IF NOT EXISTS "signature_webhooks_log" (
  "id" uuid PRIMARY KEY,
  "provider" signature_provider NOT NULL,
  "event_type" text NOT NULL,
  "document_id" uuid,
  "provider_document_id" text,
  "payload" jsonb NOT NULL,
  "headers" jsonb,
  "received_at" timestamp NOT NULL,
  "processed_at" timestamp,
  "processing_status" text NOT NULL,
  "error_message" text,
  "signature" text,
  "signature_verified" boolean,
  "created_at" timestamp NOT NULL
);

-- calendar_sharing (17 columns)
CREATE TABLE IF NOT EXISTS "calendar_sharing" (
  "id" uuid PRIMARY KEY,
  "calendar_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "shared_with_user_id" text,
  "shared_with_email" text,
  "shared_with_role" varchar(50),
  "permission" calendar_permission,
  "can_create_events" boolean,
  "can_edit_events" boolean,
  "can_delete_events" boolean,
  "can_share" boolean,
  "invited_by" text NOT NULL,
  "invited_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "is_active" boolean,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- event_reminders (12 columns)
CREATE TABLE IF NOT EXISTS "event_reminders" (
  "id" uuid PRIMARY KEY,
  "event_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "organization_id" uuid NOT NULL,
  "reminder_minutes" integer NOT NULL,
  "reminder_type" varchar(20),
  "scheduled_for" timestamp NOT NULL,
  "sent_at" timestamp,
  "status" varchar(20),
  "error" text,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL
);

-- room_bookings (30 columns)
CREATE TABLE IF NOT EXISTS "room_bookings" (
  "id" uuid PRIMARY KEY,
  "room_id" uuid NOT NULL,
  "event_id" uuid,
  "organization_id" uuid NOT NULL,
  "booked_by" text NOT NULL,
  "booked_for" text,
  "purpose" text NOT NULL,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "setup_required" boolean,
  "setup_time" integer,
  "catering_required" boolean,
  "catering_notes" text,
  "special_requests" text,
  "status" event_status,
  "requires_approval" boolean,
  "approved_by" text,
  "approved_at" timestamp,
  "approval_notes" text,
  "checked_in_at" timestamp,
  "checked_in_by" text,
  "checked_out_at" timestamp,
  "actual_end_time" timestamp,
  "cancelled_at" timestamp,
  "cancelled_by" text,
  "cancellation_reason" text,
  "attendee_count" integer,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- member_certifications (31 columns)
CREATE TABLE IF NOT EXISTS "member_certifications" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "certification_name" varchar(200) NOT NULL,
  "certification_type" varchar(100),
  "issued_by_organization" varchar(200),
  "certification_number" varchar(100),
  "issue_date" date NOT NULL,
  "expiry_date" date,
  "valid_years" integer,
  "certification_status" varchar(50),
  "course_id" uuid,
  "session_id" uuid,
  "registration_id" uuid,
  "renewal_required" boolean,
  "renewal_date" date,
  "renewal_course_id" uuid,
  "verified" boolean,
  "verification_date" date,
  "verified_by" varchar(255),
  "certificate_url" text,
  "digital_badge_url" text,
  "clc_registered" boolean,
  "clc_registration_number" varchar(100),
  "clc_registration_date" date,
  "revoked" boolean,
  "revocation_date" date,
  "revocation_reason" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- program_enrollments (16 columns)
CREATE TABLE IF NOT EXISTS "program_enrollments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "program_id" uuid NOT NULL,
  "enrollment_date" date NOT NULL,
  "enrollment_status" varchar(50),
  "courses_completed" jsonb,
  "courses_completed_count" integer,
  "electives_completed_count" integer,
  "progress_percentage" numeric(5, 2),
  "completed" boolean,
  "completion_date" date,
  "certification_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- training_programs (18 columns)
CREATE TABLE IF NOT EXISTS "training_programs" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "program_name" varchar(200) NOT NULL,
  "program_description" text,
  "program_duration" varchar(100),
  "required_courses" jsonb,
  "elective_courses" jsonb,
  "minimum_required_courses" integer,
  "minimum_elective_courses" integer,
  "provides_certification" boolean,
  "certification_name" varchar(200),
  "clc_approved" boolean,
  "clc_approval_date" date,
  "is_active" boolean,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" varchar(255)
);

-- cost_of_living_data (12 columns)
CREATE TABLE IF NOT EXISTS "cost_of_living_data" (
  "id" uuid PRIMARY KEY,
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "cpi_value" numeric(10, 2) NOT NULL,
  "cpi_vector" varchar(50),
  "inflation_rate" numeric(5, 2) NOT NULL,
  "year" integer NOT NULL,
  "ref_date" varchar(20) NOT NULL,
  "source" varchar(100) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "sync_id" varchar(100)
);

-- external_data_sync_log (16 columns)
CREATE TABLE IF NOT EXISTS "external_data_sync_log" (
  "id" uuid PRIMARY KEY,
  "source" varchar(100) NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "sync_id" varchar(100) NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "status" varchar(20) NOT NULL,
  "records_processed" integer,
  "records_inserted" integer,
  "records_updated" integer,
  "records_failed" integer,
  "error_message" text,
  "error_details" text,
  "initiated_by" varchar(100),
  "sync_type" varchar(50) NOT NULL,
  "parameters" text
);

-- union_density (21 columns)
CREATE TABLE IF NOT EXISTS "union_density" (
  "id" uuid PRIMARY KEY,
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "naics_code" varchar(10),
  "naics_name" varchar(255),
  "noc_code" varchar(10),
  "noc_name" varchar(255),
  "sex" varchar(1) NOT NULL,
  "age_group" varchar(50),
  "age_group_name" varchar(100),
  "citizenship" varchar(50),
  "citizenship_name" varchar(100),
  "union_status" varchar(50) NOT NULL,
  "union_status_name" varchar(100) NOT NULL,
  "density_value" numeric(5, 2) NOT NULL,
  "ref_date" varchar(20) NOT NULL,
  "survey_year" integer NOT NULL,
  "source" varchar(100) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "sync_id" varchar(100)
);

-- wage_benchmarks (27 columns)
CREATE TABLE IF NOT EXISTS "wage_benchmarks" (
  "id" uuid PRIMARY KEY,
  "noc_code" varchar(10) NOT NULL,
  "noc_name" varchar(255) NOT NULL,
  "noc_category" varchar(100),
  "geography_code" varchar(10) NOT NULL,
  "geography_name" varchar(255) NOT NULL,
  "geography_type" varchar(20) NOT NULL,
  "naics_code" varchar(10),
  "naics_name" varchar(255),
  "wage_value" numeric(12, 2) NOT NULL,
  "wage_unit" varchar(20) NOT NULL,
  "wage_type" varchar(50) NOT NULL,
  "sex" varchar(1) NOT NULL,
  "age_group" varchar(50),
  "age_group_name" varchar(100),
  "education_level" varchar(50),
  "statistics_type" varchar(100),
  "data_type" varchar(100),
  "ref_date" varchar(20) NOT NULL,
  "survey_year" integer NOT NULL,
  "source" varchar(100) NOT NULL,
  "data_quality_symbol" varchar(10),
  "is_terminated" boolean,
  "decimals" integer,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "sync_id" varchar(100)
);

-- external_departments (14 columns)
CREATE TABLE IF NOT EXISTS "external_departments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" external_hris_provider NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(100),
  "manager_id" varchar(255),
  "manager_name" varchar(255),
  "parent_department_id" varchar(255),
  "last_synced_at" timestamp with time zone,
  "is_active" boolean,
  "raw_data" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- external_employees (22 columns)
CREATE TABLE IF NOT EXISTS "external_employees" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" external_hris_provider NOT NULL,
  "employee_id" varchar(100),
  "first_name" varchar(100),
  "last_name" varchar(100),
  "email" varchar(255),
  "phone" varchar(50),
  "position" varchar(255),
  "department" varchar(255),
  "location" varchar(255),
  "hire_date" timestamp with time zone,
  "employment_status" employment_status,
  "work_schedule" varchar(100),
  "supervisor_id" varchar(255),
  "supervisor_name" varchar(255),
  "last_synced_at" timestamp with time zone,
  "is_active" boolean,
  "raw_data" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- external_positions (14 columns)
CREATE TABLE IF NOT EXISTS "external_positions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" external_hris_provider NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "department" varchar(255),
  "job_profile" varchar(255),
  "effective_date" timestamp with time zone,
  "last_synced_at" timestamp with time zone,
  "is_active" boolean,
  "raw_data" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- external_customers (12 columns)
CREATE TABLE IF NOT EXISTS "external_customers" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "name" varchar(500) NOT NULL,
  "company_name" varchar(500),
  "email" varchar(255),
  "phone" varchar(50),
  "balance" numeric(12, 2),
  "last_synced_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_payments (11 columns)
CREATE TABLE IF NOT EXISTS "external_payments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "customer_id" varchar(255) NOT NULL,
  "customer_name" varchar(500) NOT NULL,
  "payment_date" date NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "last_synced_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_benefit_coverage (16 columns)
CREATE TABLE IF NOT EXISTS "external_benefit_coverage" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "enrollment_id" varchar(255),
  "employee_id" varchar(255) NOT NULL,
  "plan_id" varchar(255) NOT NULL,
  "plan_type" varchar(100),
  "coverage_amount" numeric(15, 2),
  "deductible" numeric(12, 2),
  "effective_date" date NOT NULL,
  "termination_date" date,
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_benefit_dependents (13 columns)
CREATE TABLE IF NOT EXISTS "external_benefit_dependents" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "first_name" varchar(255) NOT NULL,
  "last_name" varchar(255) NOT NULL,
  "date_of_birth" date,
  "relationship" varchar(100),
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_benefit_enrollments (18 columns)
CREATE TABLE IF NOT EXISTS "external_benefit_enrollments" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "employee_name" varchar(500),
  "plan_id" varchar(255) NOT NULL,
  "plan_name" varchar(500),
  "coverage_level" varchar(100),
  "enrollment_date" date NOT NULL,
  "effective_date" date NOT NULL,
  "termination_date" date,
  "status" varchar(50) NOT NULL,
  "premium" numeric(12, 2),
  "employee_contribution" numeric(12, 2),
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_benefit_plans (16 columns)
CREATE TABLE IF NOT EXISTS "external_benefit_plans" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "plan_name" varchar(500) NOT NULL,
  "plan_type" varchar(100) NOT NULL,
  "coverage_level" varchar(100),
  "effective_date" date NOT NULL,
  "termination_date" date,
  "premium" numeric(12, 2),
  "employer_contribution" numeric(12, 2),
  "employee_contribution" numeric(12, 2),
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_benefit_utilization (15 columns)
CREATE TABLE IF NOT EXISTS "external_benefit_utilization" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "policy_id" varchar(255),
  "benefit_type" varchar(100),
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "maximum_benefit" numeric(12, 2),
  "utilized" numeric(12, 2),
  "remaining" numeric(12, 2),
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_insurance_beneficiaries (15 columns)
CREATE TABLE IF NOT EXISTS "external_insurance_beneficiaries" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "policy_id" varchar(255) NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "first_name" varchar(255) NOT NULL,
  "last_name" varchar(255) NOT NULL,
  "relationship" varchar(100),
  "percentage" integer NOT NULL,
  "is_primary" boolean NOT NULL,
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_communication_channels (14 columns)
CREATE TABLE IF NOT EXISTS "external_communication_channels" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "channel_name" varchar(255) NOT NULL,
  "channel_type" varchar(50),
  "is_archived" boolean,
  "created_at" timestamp NOT NULL,
  "creator_id" varchar(255),
  "member_count" integer,
  "topic" text,
  "description" text,
  "parent_channel_id" varchar(255),
  "last_synced_at" timestamp NOT NULL
);

-- external_communication_files (15 columns)
CREATE TABLE IF NOT EXISTS "external_communication_files" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "channel_id" uuid,
  "user_id" varchar(255),
  "file_name" varchar(500) NOT NULL,
  "file_type" varchar(50),
  "mime_type" varchar(100),
  "file_size" integer,
  "file_url" text,
  "download_url" text,
  "created_at" timestamp NOT NULL,
  "comment_count" integer,
  "last_synced_at" timestamp NOT NULL
);

-- external_communication_messages (15 columns)
CREATE TABLE IF NOT EXISTS "external_communication_messages" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "channel_id" uuid,
  "user_id" varchar(255),
  "message_text" text,
  "message_type" varchar(50),
  "timestamp" timestamp NOT NULL,
  "thread_id" varchar(255),
  "reply_count" integer,
  "reaction_count" integer,
  "edited_at" timestamp,
  "deleted_at" timestamp,
  "last_synced_at" timestamp NOT NULL
);

-- external_communication_users (17 columns)
CREATE TABLE IF NOT EXISTS "external_communication_users" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "username" varchar(255),
  "display_name" varchar(255),
  "email" varchar(255),
  "first_name" varchar(100),
  "last_name" varchar(100),
  "title" varchar(255),
  "avatar_url" text,
  "is_bot" boolean,
  "is_admin" boolean,
  "is_deleted" boolean,
  "status_text" varchar(255),
  "status_emoji" varchar(50),
  "last_synced_at" timestamp NOT NULL
);

-- external_lms_completions (10 columns)
CREATE TABLE IF NOT EXISTS "external_lms_completions" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "course_id" varchar(255) NOT NULL,
  "learner_id" varchar(255) NOT NULL,
  "completed_at" timestamp NOT NULL,
  "certificate_id" varchar(255),
  "grade" numeric(5, 2),
  "last_synced_at" timestamp NOT NULL
);

-- external_lms_courses (13 columns)
CREATE TABLE IF NOT EXISTS "external_lms_courses" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "course_name" varchar(500) NOT NULL,
  "description" text,
  "difficulty_level" varchar(50),
  "duration_minutes" integer,
  "published_at" timestamp,
  "last_updated_at" timestamp,
  "provider" varchar(255),
  "category_id" varchar(255),
  "last_synced_at" timestamp NOT NULL
);

-- external_lms_enrollments (12 columns)
CREATE TABLE IF NOT EXISTS "external_lms_enrollments" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "course_id" varchar(255) NOT NULL,
  "learner_id" varchar(255) NOT NULL,
  "enrolled_at" timestamp NOT NULL,
  "status" varchar(50) NOT NULL,
  "progress_percentage" integer,
  "last_accessed_at" timestamp,
  "completed_at" timestamp,
  "last_synced_at" timestamp NOT NULL
);

-- external_lms_learners (9 columns)
CREATE TABLE IF NOT EXISTS "external_lms_learners" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "email" varchar(255),
  "profile_url" text,
  "last_synced_at" timestamp NOT NULL
);

-- external_lms_progress (11 columns)
CREATE TABLE IF NOT EXISTS "external_lms_progress" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "course_id" varchar(255) NOT NULL,
  "learner_id" varchar(255) NOT NULL,
  "content_id" varchar(255),
  "progress_percentage" integer,
  "time_spent_seconds" integer,
  "completed_at" timestamp,
  "last_synced_at" timestamp NOT NULL
);

-- external_document_files (18 columns)
CREATE TABLE IF NOT EXISTS "external_document_files" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "library_id" uuid,
  "file_name" varchar(500) NOT NULL,
  "file_url" text,
  "file_size" integer,
  "mime_type" varchar(100),
  "is_folder" boolean,
  "folder_child_count" integer,
  "created_at" timestamp,
  "created_by" varchar(255),
  "created_by_email" varchar(255),
  "last_modified_at" timestamp,
  "last_modified_by" varchar(255),
  "parent_path" text,
  "last_synced_at" timestamp NOT NULL
);

-- external_document_libraries (12 columns)
CREATE TABLE IF NOT EXISTS "external_document_libraries" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "site_id" varchar(255),
  "library_name" varchar(255) NOT NULL,
  "library_url" text,
  "description" text,
  "drive_type" varchar(50),
  "created_at" timestamp,
  "created_by" varchar(255),
  "last_synced_at" timestamp NOT NULL
);

-- external_document_permissions (12 columns)
CREATE TABLE IF NOT EXISTS "external_document_permissions" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "file_id" uuid,
  "user_id" varchar(255),
  "group_id" varchar(255),
  "roles" varchar(255),
  "permission_type" varchar(50),
  "scope" varchar(50),
  "granted_to" varchar(255),
  "last_synced_at" timestamp NOT NULL
);

-- external_document_sites (10 columns)
CREATE TABLE IF NOT EXISTS "external_document_sites" (
  "id" uuid PRIMARY KEY,
  "org_id" uuid NOT NULL,
  "external_provider" varchar(50) NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "site_name" varchar(255) NOT NULL,
  "site_url" text,
  "description" text,
  "created_at" timestamp,
  "last_modified_at" timestamp,
  "last_synced_at" timestamp NOT NULL
);

-- external_pension_beneficiaries (16 columns)
CREATE TABLE IF NOT EXISTS "external_pension_beneficiaries" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "first_name" varchar(255) NOT NULL,
  "last_name" varchar(255) NOT NULL,
  "relationship" varchar(100) NOT NULL,
  "allocation_percent" numeric(5, 2) NOT NULL,
  "date_of_birth" date,
  "beneficiary_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL,
  "effective_date" date,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_pension_contributions (18 columns)
CREATE TABLE IF NOT EXISTS "external_pension_contributions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "plan_id" varchar(255) NOT NULL,
  "contribution_type" pension_contribution_type NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "employee_amount" numeric(12, 2),
  "employer_amount" numeric(12, 2),
  "pensionable_earnings" numeric(14, 2),
  "service_credit" numeric(6, 4),
  "pay_period" varchar(50),
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_pension_estimates (19 columns)
CREATE TABLE IF NOT EXISTS "external_pension_estimates" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "plan_id" varchar(255) NOT NULL,
  "estimate_date" date NOT NULL,
  "retirement_age" integer NOT NULL,
  "expected_retirement_date" date NOT NULL,
  "credited_service_at_retirement" numeric(8, 4),
  "annual_pension" numeric(14, 2),
  "monthly_pension" numeric(14, 2),
  "bridge_benefit" numeric(14, 2),
  "survivor_benefit" numeric(14, 2),
  "commuted_value" numeric(18, 2),
  "inflation_adjusted" boolean,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_pension_members (20 columns)
CREATE TABLE IF NOT EXISTS "external_pension_members" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "employee_id" varchar(255) NOT NULL,
  "employee_name" varchar(500),
  "plan_id" varchar(255) NOT NULL,
  "membership_number" varchar(100),
  "member_status" pension_member_status NOT NULL,
  "enrollment_date" date NOT NULL,
  "vesting_date" date,
  "termination_date" date,
  "credited_service" numeric(8, 4),
  "eligible_service" numeric(8, 4),
  "pensionable_salary" numeric(14, 2),
  "date_of_birth" date,
  "expected_retirement_date" date,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_pension_plans (20 columns)
CREATE TABLE IF NOT EXISTS "external_pension_plans" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "plan_name" varchar(500) NOT NULL,
  "plan_type" pension_plan_type NOT NULL,
  "plan_number" varchar(100),
  "jurisdiction" varchar(100),
  "regulatory_body" varchar(255),
  "effective_date" date NOT NULL,
  "termination_date" date,
  "employee_contribution_rate" numeric(6, 4),
  "employer_contribution_rate" numeric(6, 4),
  "vesting_period_months" integer,
  "normal_retirement_age" integer,
  "early_retirement_age" integer,
  "status" varchar(50) NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_pension_service_credits (16 columns)
CREATE TABLE IF NOT EXISTS "external_pension_service_credits" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" pension_provider NOT NULL,
  "member_id" varchar(255) NOT NULL,
  "plan_id" varchar(255) NOT NULL,
  "credit_type" varchar(100) NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "credited_years" numeric(8, 4) NOT NULL,
  "cost_of_buyback" numeric(14, 2),
  "approved" boolean,
  "approval_date" date,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_calendar_attendees (14 columns)
CREATE TABLE IF NOT EXISTS "external_calendar_attendees" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" calendar_provider NOT NULL,
  "event_id" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "display_name" varchar(255),
  "response_status" attendee_response NOT NULL,
  "is_organizer" boolean,
  "is_optional" boolean,
  "comment" text,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_calendar_events (24 columns)
CREATE TABLE IF NOT EXISTS "external_calendar_events" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" calendar_provider NOT NULL,
  "calendar_id" varchar(255) NOT NULL,
  "title" varchar(500) NOT NULL,
  "description" text,
  "location" varchar(500),
  "meeting_url" text,
  "event_type" calendar_event_type,
  "status" calendar_event_status NOT NULL,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "all_day" boolean,
  "is_recurring" boolean,
  "recurring_event_id" varchar(255),
  "organizer_email" varchar(255),
  "organizer_name" varchar(255),
  "visibility" varchar(20),
  "importance" varchar(20),
  "attendee_count" integer,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_calendar_recurring_patterns (16 columns)
CREATE TABLE IF NOT EXISTS "external_calendar_recurring_patterns" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" calendar_provider NOT NULL,
  "event_id" varchar(255) NOT NULL,
  "frequency" varchar(20) NOT NULL,
  "interval_count" integer,
  "days_of_week" varchar(100),
  "day_of_month" integer,
  "month_of_year" integer,
  "count" integer,
  "until_date" timestamp with time zone,
  "exceptions" text,
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- external_calendars (16 columns)
CREATE TABLE IF NOT EXISTS "external_calendars" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "external_provider" calendar_provider NOT NULL,
  "calendar_name" varchar(500) NOT NULL,
  "description" text,
  "color" varchar(20),
  "timezone" varchar(100),
  "owner_email" varchar(255),
  "is_shared" boolean,
  "can_edit" boolean,
  "sync_enabled" boolean,
  "sync_direction" varchar(20),
  "last_synced_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- model_metadata (7 columns)
CREATE TABLE IF NOT EXISTS "model_metadata" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "model_type" varchar(50) NOT NULL,
  "version" varchar(20) NOT NULL,
  "accuracy" numeric,
  "trained_at" timestamp NOT NULL,
  "parameters" jsonb
);

-- ai_budgets (10 columns)
CREATE TABLE IF NOT EXISTS "ai_budgets" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "monthly_limit_usd" numeric(10, 2) NOT NULL,
  "current_spend_usd" numeric(10, 2),
  "alert_threshold" numeric(3, 2),
  "hard_limit" boolean,
  "billing_period_start" date NOT NULL,
  "billing_period_end" date NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- ai_rate_limits (9 columns)
CREATE TABLE IF NOT EXISTS "ai_rate_limits" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "limit_type" text NOT NULL,
  "limit_value" integer NOT NULL,
  "current_value" integer,
  "window_start" timestamp,
  "window_duration" interval NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- ai_usage_metrics (15 columns)
CREATE TABLE IF NOT EXISTS "ai_usage_metrics" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "operation" text NOT NULL,
  "tokens_input" integer NOT NULL,
  "tokens_output" integer NOT NULL,
  "tokens_total" integer NOT NULL,
  "estimated_cost" numeric(10, 6) NOT NULL,
  "request_id" text,
  "user_id" text,
  "session_id" uuid,
  "latency_ms" integer,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL
);

-- chatbot_analytics (18 columns)
CREATE TABLE IF NOT EXISTS "chatbot_analytics" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "total_sessions" integer NOT NULL,
  "total_messages" integer NOT NULL,
  "unique_users" integer NOT NULL,
  "avg_response_time_ms" integer,
  "avg_tokens_per_message" integer,
  "avg_messages_per_session" integer,
  "helpful_responses" integer NOT NULL,
  "unhelpful_responses" integer NOT NULL,
  "satisfaction_rate" text,
  "total_tokens_used" integer NOT NULL,
  "estimated_cost_usd" text,
  "top_categories" jsonb,
  "top_questions" jsonb,
  "created_at" timestamp NOT NULL
);

-- chatbot_suggestions (14 columns)
CREATE TABLE IF NOT EXISTS "chatbot_suggestions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "prompt" text NOT NULL,
  "description" text,
  "icon" text,
  "display_order" integer NOT NULL,
  "show_in_contexts" jsonb,
  "required_tags" jsonb,
  "use_count" integer NOT NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- analytics_scheduled_reports (23 columns)
CREATE TABLE IF NOT EXISTS "analytics_scheduled_reports" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "report_name" text NOT NULL,
  "report_type" text NOT NULL,
  "report_description" text,
  "report_parameters" jsonb NOT NULL,
  "schedule_type" text NOT NULL,
  "cron_expression" text,
  "timezone" text,
  "next_run_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "recipients" jsonb NOT NULL,
  "delivery_format" text NOT NULL,
  "include_attachments" boolean,
  "email_subject" text,
  "email_body" text,
  "is_active" boolean,
  "run_count" integer,
  "last_run_status" text,
  "last_run_error" text,
  "created_by" varchar(255),
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- benchmark_categories (14 columns)
CREATE TABLE IF NOT EXISTS "benchmark_categories" (
  "id" uuid PRIMARY KEY,
  "category_name" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "category_group" text NOT NULL,
  "unit_type" text NOT NULL,
  "calculation_method" text,
  "higher_is_better" boolean,
  "display_order" integer,
  "icon" text,
  "color" text,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- benchmark_data (22 columns)
CREATE TABLE IF NOT EXISTS "benchmark_data" (
  "id" uuid PRIMARY KEY,
  "benchmark_category_id" uuid NOT NULL,
  "union_type" text NOT NULL,
  "union_size_bracket" text NOT NULL,
  "region" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "period_type" text NOT NULL,
  "metric_value" numeric(15, 2) NOT NULL,
  "sample_size" integer NOT NULL,
  "min_value" numeric(15, 2),
  "max_value" numeric(15, 2),
  "percentile_25" numeric(15, 2),
  "percentile_50" numeric(15, 2),
  "percentile_75" numeric(15, 2),
  "standard_deviation" numeric(15, 2),
  "data_quality_score" integer,
  "is_projected" boolean,
  "confidence_level" text,
  "data_source" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- organization_benchmark_snapshots (20 columns)
CREATE TABLE IF NOT EXISTS "organization_benchmark_snapshots" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "benchmark_category_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "period_type" text NOT NULL,
  "metric_value" numeric(15, 2) NOT NULL,
  "benchmark_value" numeric(15, 2),
  "variance_from_benchmark" numeric(15, 2),
  "variance_percentage" numeric(8, 2),
  "percentile_rank" integer,
  "performance_indicator" text,
  "previous_period_value" numeric(15, 2),
  "period_over_period_change" numeric(15, 2),
  "period_over_period_percentage" numeric(8, 2),
  "trend_direction" text,
  "data_completeness_percentage" integer,
  "calculation_notes" text,
  "calculated_at" timestamp with time zone,
  "created_at" timestamp with time zone
);

-- report_delivery_history (26 columns)
CREATE TABLE IF NOT EXISTS "report_delivery_history" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "scheduled_report_id" uuid,
  "report_name" text NOT NULL,
  "report_type" text NOT NULL,
  "delivery_method" text NOT NULL,
  "recipients" jsonb NOT NULL,
  "delivery_format" text NOT NULL,
  "file_url" text,
  "file_size_bytes" bigint,
  "file_hash" text,
  "expires_at" timestamp with time zone,
  "status" text NOT NULL,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "error_message" text,
  "retry_count" integer,
  "email_subject" text,
  "email_opened" boolean,
  "email_opened_at" timestamp with time zone,
  "email_clicked" boolean,
  "email_clicked_at" timestamp with time zone,
  "generation_time_ms" integer,
  "delivery_time_ms" integer,
  "triggered_by" varchar(255),
  "created_at" timestamp with time zone
);

-- alert_actions (9 columns)
CREATE TABLE IF NOT EXISTS "alert_actions" (
  "id" uuid PRIMARY KEY,
  "alert_rule_id" uuid NOT NULL,
  "action_type" alert_action_type NOT NULL,
  "action_config" jsonb NOT NULL,
  "order_index" integer NOT NULL,
  "execute_if_condition" jsonb,
  "max_retries" integer NOT NULL,
  "retry_delay_seconds" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

-- alert_conditions (9 columns)
CREATE TABLE IF NOT EXISTS "alert_conditions" (
  "id" uuid PRIMARY KEY,
  "alert_rule_id" uuid NOT NULL,
  "field_path" varchar(255) NOT NULL,
  "operator" alert_condition_operator NOT NULL,
  "value" jsonb,
  "condition_group" integer NOT NULL,
  "is_or_condition" boolean NOT NULL,
  "order_index" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

-- alert_escalations (15 columns)
CREATE TABLE IF NOT EXISTS "alert_escalations" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "alert_rule_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "escalation_levels" jsonb NOT NULL,
  "current_level" integer NOT NULL,
  "status" escalation_status NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "next_escalation_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "resolved_by" text,
  "resolution_notes" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- alert_executions (14 columns)
CREATE TABLE IF NOT EXISTS "alert_executions" (
  "id" uuid PRIMARY KEY,
  "alert_rule_id" uuid NOT NULL,
  "triggered_by" alert_trigger_type NOT NULL,
  "trigger_data" jsonb,
  "status" alert_execution_status NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "conditions_met" boolean,
  "conditions_evaluated" jsonb,
  "actions_executed" jsonb,
  "error_message" text,
  "error_details" jsonb,
  "execution_time_ms" integer,
  "created_at" timestamp with time zone NOT NULL
);

-- alert_recipients (9 columns)
CREATE TABLE IF NOT EXISTS "alert_recipients" (
  "id" uuid PRIMARY KEY,
  "alert_rule_id" uuid NOT NULL,
  "recipient_type" varchar(50) NOT NULL,
  "recipient_id" uuid,
  "recipient_value" varchar(255),
  "delivery_methods" varchar(50)[] NOT NULL,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "created_at" timestamp with time zone NOT NULL
);

-- workflow_definitions (18 columns)
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "category" varchar(100),
  "trigger_type" workflow_trigger_type NOT NULL,
  "trigger_config" jsonb NOT NULL,
  "workflow_steps" jsonb NOT NULL,
  "is_enabled" boolean NOT NULL,
  "is_deleted" boolean NOT NULL,
  "version" integer NOT NULL,
  "last_executed_at" timestamp with time zone,
  "execution_count" integer NOT NULL,
  "success_count" integer NOT NULL,
  "failure_count" integer NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- workflow_executions (19 columns)
CREATE TABLE IF NOT EXISTS "workflow_executions" (
  "id" uuid PRIMARY KEY,
  "workflow_definition_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "triggered_by" workflow_trigger_type NOT NULL,
  "trigger_data" jsonb,
  "status" workflow_execution_status NOT NULL,
  "current_step" integer NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "paused_at" timestamp with time zone,
  "resumed_at" timestamp with time zone,
  "step_results" jsonb,
  "variables" jsonb,
  "error_message" text,
  "error_details" jsonb,
  "failed_step" integer,
  "total_execution_time_ms" integer,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- automation_execution_log (13 columns)
CREATE TABLE IF NOT EXISTS "automation_execution_log" (
  "id" uuid PRIMARY KEY,
  "rule_id" uuid NOT NULL,
  "triggered_by" varchar(255) NOT NULL,
  "trigger_type" varchar(50) NOT NULL,
  "target_entity_type" varchar(50) NOT NULL,
  "target_entity_id" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL,
  "error_message" text,
  "error_details" jsonb,
  "actions_executed" jsonb,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer
);

-- automation_schedules (9 columns)
CREATE TABLE IF NOT EXISTS "automation_schedules" (
  "id" uuid PRIMARY KEY,
  "rule_id" uuid NOT NULL,
  "schedule_type" varchar(50) NOT NULL,
  "schedule_config" jsonb,
  "next_run_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "status" varchar(20) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- award_history (18 columns)
CREATE TABLE IF NOT EXISTS "award_history" (
  "id" uuid PRIMARY KEY,
  "template_id" uuid NOT NULL,
  "recipient_id" varchar(255) NOT NULL,
  "recipient_name" varchar(255) NOT NULL,
  "recipient_email" varchar(255),
  "points_awarded" integer,
  "monetary_value" integer,
  "badge_awarded" boolean,
  "giver_id" varchar(255) NOT NULL,
  "giver_name" varchar(255) NOT NULL,
  "reason" text,
  "visibility" varchar(20),
  "status" varchar(20) NOT NULL,
  "approved_by" varchar(255),
  "approved_at" timestamp with time zone,
  "redeemed_at" timestamp with time zone,
  "redemption_notes" text,
  "awarded_at" timestamp with time zone NOT NULL
);

-- award_templates (27 columns)
CREATE TABLE IF NOT EXISTS "award_templates" (
  "id" uuid PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "message" text NOT NULL,
  "category" varchar(50) NOT NULL,
  "type" varchar(50) NOT NULL,
  "points_value" integer,
  "monetary_value" integer,
  "currency" varchar(3),
  "badge_name" varchar(100),
  "badge_icon" varchar(500),
  "badge_color" varchar(20),
  "tags" jsonb,
  "use_count" integer,
  "max_uses" integer,
  "per_user_limit" integer,
  "valid_from" timestamp with time zone,
  "valid_until" timestamp with time zone,
  "status" varchar(20) NOT NULL,
  "organization_id" varchar(255),
  "requires_approval" boolean,
  "approver_roles" jsonb,
  "total_awarded" integer,
  "total_value_awarded" integer,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255)
);

-- budget_pool (13 columns)
CREATE TABLE IF NOT EXISTS "budget_pool" (
  "id" uuid PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "organization_id" varchar(255) NOT NULL,
  "total_budget" integer NOT NULL,
  "allocated_budget" integer NOT NULL,
  "spent_budget" integer NOT NULL,
  "fiscal_year" integer NOT NULL,
  "quarter" integer,
  "status" varchar(20) NOT NULL,
  "manager_id" varchar(255),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- budget_reservations (9 columns)
CREATE TABLE IF NOT EXISTS "budget_reservations" (
  "id" uuid PRIMARY KEY,
  "pool_id" uuid NOT NULL,
  "reserved_amount" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "reference_type" varchar(50) NOT NULL,
  "reference_id" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- card_signing_events (23 columns)
CREATE TABLE IF NOT EXISTS "card_signing_events" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "signed_date" date NOT NULL,
  "signed_time" time,
  "signing_location" varchar(255),
  "witnessed_by" text,
  "witness_signature_data" jsonb,
  "card_photo_url" text,
  "card_type" varchar(50),
  "card_status" varchar(50) NOT NULL,
  "invalidation_reason" text,
  "voluntary_signature" boolean NOT NULL,
  "signature_obtained_properly" boolean NOT NULL,
  "date_accurate" boolean NOT NULL,
  "meets_legal_requirements" boolean,
  "submitted_to_nlrb_clrb" boolean,
  "submission_date" date,
  "submission_batch_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone,
  "created_by" text
);

-- employer_responses (43 columns)
CREATE TABLE IF NOT EXISTS "employer_responses" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "response_date" date NOT NULL,
  "response_type" varchar(50) NOT NULL,
  "response_summary" text NOT NULL,
  "response_severity" varchar(20),
  "meeting_attendance_mandatory" boolean,
  "meeting_location" text,
  "meeting_date_time" timestamp,
  "speakers" text[],
  "talking_points" text[],
  "materials_distributed" text[],
  "material_urls" text[],
  "material_content_summary" text,
  "anti_union_consultant_name" varchar(255),
  "consultant_firm" varchar(255),
  "consultant_tactics" text[],
  "employee_disciplined" boolean,
  "employee_terminated" boolean,
  "affected_contact_id" uuid,
  "alleged_reason" text,
  "suspected_retaliation" boolean,
  "surveillance_reported" boolean,
  "surveillance_description" text,
  "intimidation_tactics" text[],
  "potential_ulp" boolean,
  "ulp_filed" boolean,
  "ulp_case_number" varchar(100),
  "nlrb_clrb_complaint_filed" boolean,
  "union_counter_strategy" text,
  "union_action_taken" text[],
  "organizers_assigned_response" uuid[],
  "impact_on_campaign" varchar(20),
  "contacts_influenced" integer,
  "estimated_support_lost" numeric(5, 2),
  "evidence_documents" text[],
  "witness_statements" text[],
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

-- field_organizer_activities (32 columns)
CREATE TABLE IF NOT EXISTS "field_organizer_activities" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "organizer_id" text NOT NULL,
  "contact_id" uuid,
  "activity_date" date NOT NULL,
  "activity_type" varchar(50) NOT NULL,
  "activity_duration_minutes" integer,
  "activity_location" text,
  "gps_latitude" numeric(10, 8),
  "gps_longitude" numeric(11, 8),
  "offline_mode_used" boolean,
  "contact_made" boolean NOT NULL,
  "commitment_level_before" varchar(50),
  "commitment_level_after" varchar(50),
  "card_signed" boolean,
  "follow_up_needed" boolean,
  "follow_up_date" date,
  "issues_discussed" text[],
  "concerns_raised" text[],
  "questions_asked" text[],
  "materials_distributed" text[],
  "interaction_quality" varchar(20),
  "likely_to_vote_yes" boolean,
  "willing_to_help_organize" boolean,
  "potential_leader" boolean,
  "detailed_notes" text,
  "organizer_observations" text,
  "next_steps" text,
  "created_at" timestamp with time zone,
  "synced_at" timestamp with time zone,
  "created_by" text
);

-- nlrb_clrb_filings (43 columns)
CREATE TABLE IF NOT EXISTS "nlrb_clrb_filings" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "filing_type" varchar(50) NOT NULL,
  "filing_number" varchar(100),
  "jurisdiction" varchar(50) NOT NULL,
  "filed_date" date NOT NULL,
  "filed_by" varchar(255),
  "employer_notified_date" date,
  "bargaining_unit_description" text NOT NULL,
  "unit_size_claimed" integer NOT NULL,
  "unit_job_classifications" text[],
  "excluded_positions" text[],
  "showing_of_interest_percentage" numeric(5, 2),
  "cards_submitted_count" integer,
  "card_submission_batch_ids" uuid[],
  "status" varchar(50) NOT NULL,
  "hearing_date" date,
  "hearing_location" text,
  "hearing_outcome" varchar(50),
  "election_scheduled_date" date,
  "election_location" text,
  "election_type" varchar(50),
  "election_conducted" boolean,
  "petition_document_url" text,
  "showing_of_interest_document_url" text,
  "hearing_transcripts_url" text,
  "decision_document_url" text,
  "employer_contested" boolean,
  "employer_objections" text[],
  "employer_counter_arguments" text,
  "employer_representation" varchar(255),
  "decision_date" date,
  "decision_summary" text,
  "unit_approved" boolean,
  "approved_unit_size" integer,
  "approved_job_classifications" text[],
  "appeal_filed" boolean,
  "appeal_status" varchar(50),
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

-- organizing_campaign_milestones (20 columns)
CREATE TABLE IF NOT EXISTS "organizing_campaign_milestones" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "milestone_name" varchar(255) NOT NULL,
  "milestone_type" varchar(50) NOT NULL,
  "target_date" date NOT NULL,
  "completed" boolean,
  "completed_date" date,
  "target_metric" varchar(50),
  "target_value" integer,
  "current_value" integer,
  "progress_percentage" numeric(5, 2),
  "status" varchar(50),
  "days_until_deadline" integer,
  "reminder_sent" boolean,
  "reminder_date" date,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text
);

-- organizing_campaigns (40 columns)
CREATE TABLE IF NOT EXISTS "organizing_campaigns" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_name" varchar(255) NOT NULL,
  "campaign_code" varchar(50) NOT NULL,
  "target_employer" varchar(255) NOT NULL,
  "workplace_location" text NOT NULL,
  "industry" varchar(100),
  "campaign_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL,
  "priority" varchar(20),
  "estimated_unit_size" integer NOT NULL,
  "target_card_count" integer,
  "cards_signed" integer,
  "card_signing_progress" numeric(5, 2),
  "lead_organizer_id" text,
  "organizing_team" uuid[],
  "campaign_start_date" date,
  "target_card_deadline" date,
  "filing_date" date,
  "election_date" date,
  "certification_date" date,
  "campaign_end_date" date,
  "organizing_strategy" text,
  "key_issues" text[],
  "employer_vulnerabilities" text[],
  "union_advantages" text[],
  "contacts_identified" integer,
  "contacts_committed" integer,
  "house_visits_completed" integer,
  "workplace_meetings_held" integer,
  "election_eligible_voters" integer,
  "votes_for_union" integer,
  "votes_against_union" integer,
  "challenged_ballots" integer,
  "election_result" varchar(50),
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "archived_at" timestamp with time zone
);

-- organizing_contacts (37 columns)
CREATE TABLE IF NOT EXISTS "organizing_contacts" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "email" varchar(255),
  "phone" varchar(20),
  "preferred_contact_method" varchar(20),
  "job_title" varchar(100),
  "department" varchar(100),
  "shift" varchar(50),
  "hire_date" date,
  "seniority_years" numeric(4, 1),
  "work_location" varchar(255),
  "supervisor" varchar(100),
  "immediate_coworkers" text[],
  "influence_level" varchar(20),
  "commitment_level" varchar(50) NOT NULL,
  "union_sentiment" varchar(20),
  "card_signed" boolean,
  "card_signed_date" date,
  "willing_to_organize" boolean,
  "issues_concerned_about" text[],
  "first_contact_date" date,
  "last_contact_date" date,
  "total_contacts" integer,
  "house_visit_completed" boolean,
  "house_visit_date" date,
  "likely_to_vote_yes" boolean,
  "employer_loyalist" boolean,
  "potential_risks" text,
  "notes" text,
  "tags" text[],
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

-- union_representation_votes (35 columns)
CREATE TABLE IF NOT EXISTS "union_representation_votes" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "filing_id" uuid,
  "vote_date" date NOT NULL,
  "vote_type" varchar(50) NOT NULL,
  "voting_method" varchar(50),
  "eligible_voters" integer NOT NULL,
  "ballots_cast" integer NOT NULL,
  "voter_turnout_percentage" numeric(5, 2),
  "votes_for_union" integer NOT NULL,
  "votes_against_union" integer NOT NULL,
  "challenged_ballots" integer,
  "void_ballots" integer,
  "union_vote_percentage" numeric(5, 2),
  "result" varchar(50) NOT NULL,
  "certification_issued" boolean,
  "certification_date" date,
  "vote_breakdown_by_department" jsonb,
  "vote_breakdown_by_shift" jsonb,
  "union_filed_objections" boolean,
  "employer_filed_objections" boolean,
  "objections_summary" text,
  "objections_resolved" boolean,
  "objections_resolution" text,
  "recount_requested" boolean,
  "recount_date" date,
  "recount_result" varchar(50),
  "certification_number" varchar(100),
  "bargaining_unit_certified" text,
  "union_representative_name" varchar(255),
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_by" text
);

-- cross_org_access_log (12 columns)
CREATE TABLE IF NOT EXISTS "cross_org_access_log" (
  "id" uuid PRIMARY KEY,
  "user_id" varchar(255) NOT NULL,
  "user_organization_id" uuid NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" uuid NOT NULL,
  "resource_organization_id" uuid NOT NULL,
  "access_type" varchar(50) NOT NULL,
  "access_granted_via" varchar(50),
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL
);

-- organization_sharing_grants (14 columns)
CREATE TABLE IF NOT EXISTS "organization_sharing_grants" (
  "id" uuid PRIMARY KEY,
  "grantor_org_id" uuid NOT NULL,
  "grantee_org_id" uuid NOT NULL,
  "resource_type" varchar(50) NOT NULL,
  "all_resources" boolean,
  "specific_resource_ids" uuid[],
  "grant_reason" text,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" varchar(255),
  "revoke_reason" text,
  "granted_by" varchar(255) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- cms_blocks (12 columns)
CREATE TABLE IF NOT EXISTS "cms_blocks" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "block_type" text NOT NULL,
  "category" text,
  "content" jsonb NOT NULL,
  "styles" jsonb,
  "is_reusable" boolean,
  "thumbnail_url" text,
  "created_by" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- cms_media_library (15 columns)
CREATE TABLE IF NOT EXISTS "cms_media_library" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_type" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "alt_text" text,
  "caption" text,
  "tags" text[],
  "folder" text,
  "uploaded_by" text,
  "created_at" timestamp with time zone
);

-- cms_navigation_menus (8 columns)
CREATE TABLE IF NOT EXISTS "cms_navigation_menus" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "location" text NOT NULL,
  "items" jsonb NOT NULL,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- cms_templates (13 columns)
CREATE TABLE IF NOT EXISTS "cms_templates" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "template_type" text NOT NULL,
  "category" text,
  "thumbnail_url" text,
  "layout_config" jsonb NOT NULL,
  "is_system" boolean,
  "is_published" boolean,
  "created_by" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- event_check_ins (9 columns)
CREATE TABLE IF NOT EXISTS "event_check_ins" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "registration_id" uuid NOT NULL,
  "check_in_method" text NOT NULL,
  "checked_in_by" text,
  "check_in_location" text,
  "notes" text,
  "created_at" timestamp with time zone
);

-- event_registrations (27 columns)
CREATE TABLE IF NOT EXISTS "event_registrations" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "profile_id" text,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "member_number" text,
  "ticket_type" text,
  "ticket_price" numeric(10, 2),
  "number_of_guests" integer,
  "guest_names" text[],
  "custom_data" jsonb,
  "registration_status" text NOT NULL,
  "payment_status" text,
  "stripe_payment_intent_id" text,
  "payment_method" text,
  "confirmation_sent" boolean,
  "reminder_sent" boolean,
  "checked_in" boolean,
  "checked_in_at" timestamp with time zone,
  "checked_in_by" text,
  "qr_code" text,
  "registration_source" text,
  "registered_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- job_applications (31 columns)
CREATE TABLE IF NOT EXISTS "job_applications" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "job_posting_id" uuid NOT NULL,
  "profile_id" text,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "resume_url" text,
  "cover_letter_url" text,
  "cover_letter_text" text,
  "linkedin_url" text,
  "portfolio_url" text,
  "years_experience" integer,
  "current_employer" text,
  "current_position" text,
  "availability_date" date,
  "salary_expectation" numeric(10, 2),
  "willing_to_relocate" boolean,
  "is_union_member" boolean,
  "union_local" text,
  "custom_responses" jsonb,
  "application_status" text NOT NULL,
  "status_notes" text,
  "viewed_by" text,
  "viewed_at" timestamp with time zone,
  "interview_scheduled_for" timestamp with time zone,
  "rejection_reason" text,
  "source" text,
  "applied_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- job_postings (49 columns)
CREATE TABLE IF NOT EXISTS "job_postings" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "employer_name" text NOT NULL,
  "employer_logo" text,
  "employer_website" text,
  "job_type" text NOT NULL,
  "category" text,
  "description" text NOT NULL,
  "responsibilities" text,
  "qualifications" text,
  "benefits" text,
  "salary_min" numeric(10, 2),
  "salary_max" numeric(10, 2),
  "salary_currency" text,
  "salary_period" text,
  "salary_display" text,
  "location_type" text NOT NULL,
  "city" text,
  "province" text,
  "country" text,
  "remote_allowed" boolean,
  "experience_level" text,
  "education_required" text,
  "union_affiliation_required" boolean,
  "union_name" text,
  "contact_name" text,
  "contact_email" text NOT NULL,
  "contact_phone" text,
  "application_method" text NOT NULL,
  "application_email" text,
  "application_url" text,
  "application_instructions" text,
  "requires_resume" boolean,
  "requires_cover_letter" boolean,
  "custom_questions" jsonb,
  "status" text NOT NULL,
  "featured" boolean,
  "views_count" integer,
  "applications_count" integer,
  "posted_date" date NOT NULL,
  "closing_date" date,
  "filled_date" date,
  "seo_config" jsonb,
  "tags" text[],
  "created_by" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- job_saved (6 columns)
CREATE TABLE IF NOT EXISTS "job_saved" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "profile_id" text NOT NULL,
  "job_posting_id" uuid NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone
);

-- page_analytics (15 columns)
CREATE TABLE IF NOT EXISTS "page_analytics" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "page_id" uuid,
  "event_id" uuid,
  "job_id" uuid,
  "campaign_id" uuid,
  "metric_date" date NOT NULL,
  "page_views" integer,
  "unique_visitors" integer,
  "avg_time_on_page" integer,
  "bounce_rate" numeric(5, 2),
  "traffic_sources" jsonb,
  "device_breakdown" jsonb,
  "conversion_count" integer,
  "created_at" timestamp with time zone
);

-- public_events (43 columns)
CREATE TABLE IF NOT EXISTS "public_events" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "event_type" text NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "timezone" text,
  "location_type" text NOT NULL,
  "venue_name" text,
  "venue_address" text,
  "venue_city" text,
  "venue_state" text,
  "venue_postal_code" text,
  "venue_country" text,
  "virtual_link" text,
  "virtual_platform" text,
  "featured_image" text,
  "capacity" integer,
  "registered_count" integer,
  "waitlist_enabled" boolean,
  "registration_opens" timestamp with time zone,
  "registration_closes" timestamp with time zone,
  "registration_status" text NOT NULL,
  "is_free" boolean,
  "ticket_price" numeric(10, 2),
  "member_price" numeric(10, 2),
  "currency" text,
  "custom_fields" jsonb,
  "confirmation_email_template" text,
  "reminder_email_template" text,
  "page_content" jsonb,
  "seo_config" jsonb,
  "tags" text[],
  "organizer_name" text,
  "organizer_email" text,
  "organizer_phone" text,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "created_by" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- website_settings (24 columns)
CREATE TABLE IF NOT EXISTS "website_settings" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "site_name" text NOT NULL,
  "site_tagline" text,
  "site_description" text,
  "logo_url" text,
  "favicon_url" text,
  "primary_color" text,
  "secondary_color" text,
  "font_family" text,
  "footer_text" text,
  "footer_links" jsonb,
  "social_links" jsonb,
  "contact_email" text,
  "contact_phone" text,
  "contact_address" text,
  "google_analytics_id" text,
  "facebook_pixel_id" text,
  "custom_css" text,
  "custom_js" text,
  "maintenance_mode" boolean,
  "maintenance_message" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

-- social_accounts (26 columns)
CREATE TABLE IF NOT EXISTS "social_accounts" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "platform" social_platform NOT NULL,
  "platform_user_id" text NOT NULL,
  "username" text NOT NULL,
  "display_name" text NOT NULL,
  "profile_image_url" text,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "token_expires_at" timestamp with time zone,
  "scopes" text[],
  "status" social_account_status NOT NULL,
  "is_primary" boolean,
  "is_verified" boolean,
  "rate_limit_remaining" integer,
  "rate_limit_reset_at" timestamp with time zone,
  "follower_count" integer,
  "following_count" integer,
  "post_count" integer,
  "engagement_rate" numeric(5, 2),
  "account_metadata" jsonb,
  "connected_by" text,
  "connected_at" timestamp with time zone NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- social_campaigns (18 columns)
CREATE TABLE IF NOT EXISTS "social_campaigns" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "campaign_code" text,
  "platforms" text[],
  "target_audience" text,
  "campaign_hashtags" text[],
  "status" campaign_status NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "goal_impressions" integer,
  "goal_engagement_rate" numeric(5, 2),
  "goal_conversions" integer,
  "campaign_metadata" jsonb,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- social_engagement (17 columns)
CREATE TABLE IF NOT EXISTS "social_engagement" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "engagement_type" engagement_type NOT NULL,
  "platform_engagement_id" text,
  "platform_user_id" text,
  "username" text,
  "display_name" text,
  "profile_image_url" text,
  "content" text,
  "sentiment" text,
  "sentiment_score" numeric(5, 2),
  "engaged_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL,
  "engagement_metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- social_feeds (19 columns)
CREATE TABLE IF NOT EXISTS "social_feeds" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "platform_item_id" text NOT NULL,
  "item_type" text NOT NULL,
  "content" text,
  "media_urls" text[],
  "author_id" text,
  "author_name" text,
  "author_username" text,
  "author_image_url" text,
  "likes_count" integer,
  "comments_count" integer,
  "shares_count" integer,
  "published_at" timestamp with time zone NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL,
  "feed_metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- social_posts (30 columns)
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "campaign_id" uuid,
  "post_type" social_post_type NOT NULL,
  "content" text NOT NULL,
  "media_urls" text[],
  "link_url" text,
  "link_preview_image" text,
  "hashtags" text[],
  "mentions" text[],
  "status" social_post_status NOT NULL,
  "scheduled_for" timestamp with time zone,
  "published_at" timestamp with time zone,
  "platform_post_id" text,
  "platform_url" text,
  "likes_count" integer,
  "comments_count" integer,
  "shares_count" integer,
  "impressions_count" integer,
  "reach_count" integer,
  "engagement_rate" numeric(5, 2),
  "error_message" text,
  "retry_count" integer,
  "last_retry_at" timestamp with time zone,
  "post_metadata" jsonb,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "deleted_at" timestamp with time zone
);

-- accessibility_test_suites (21 columns)
CREATE TABLE IF NOT EXISTS "accessibility_test_suites" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid,
  "suite_name" text NOT NULL,
  "suite_description" text,
  "suite_type" text NOT NULL,
  "url_patterns" jsonb,
  "exclude_patterns" jsonb,
  "enabled_rules" jsonb,
  "disabled_rules" jsonb,
  "custom_rules" jsonb,
  "is_scheduled" boolean NOT NULL,
  "schedule_expression" text,
  "notify_on_failure" boolean NOT NULL,
  "notify_emails" jsonb,
  "notify_slack_channel" text,
  "is_active" boolean NOT NULL,
  "last_run_at" timestamp,
  "last_run_status" audit_status,
  "created_by" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- accessibility_user_testing (21 columns)
CREATE TABLE IF NOT EXISTS "accessibility_user_testing" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "session_name" text NOT NULL,
  "session_date" timestamp NOT NULL,
  "participant_name" text NOT NULL,
  "participant_email" text,
  "assistive_technology" text,
  "assistive_tech_version" text,
  "disability" text,
  "features_tested" jsonb,
  "task_list" jsonb,
  "overall_rating" integer,
  "issues_found" jsonb,
  "positive_findings" jsonb,
  "recording_url" text,
  "transcript_url" text,
  "notes" text,
  "follow_up_required" boolean NOT NULL,
  "follow_up_notes" text,
  "conducted_by" text NOT NULL,
  "created_at" timestamp NOT NULL
);

-- wcag_success_criteria (16 columns)
CREATE TABLE IF NOT EXISTS "wcag_success_criteria" (
  "id" uuid PRIMARY KEY,
  "criteria_number" text NOT NULL,
  "criteria_title" text NOT NULL,
  "criteria_description" text NOT NULL,
  "level" wcag_level NOT NULL,
  "wcag_version" text NOT NULL,
  "principle" text NOT NULL,
  "guideline" text NOT NULL,
  "understanding_url" text,
  "how_to_meet_url" text,
  "testing_procedure" text,
  "common_failures" jsonb,
  "sufficient_techniques" jsonb,
  "keywords" jsonb,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

-- integration_sync_schedules (11 columns)
CREATE TABLE IF NOT EXISTS "integration_sync_schedules" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "provider" integration_provider NOT NULL,
  "sync_type" sync_type NOT NULL,
  "orgs" text[],
  "schedule" text NOT NULL,
  "enabled" boolean,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp,
  "updated_at" timestamp
);

-- webhook_deliveries (10 columns)
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY,
  "webhook_id" uuid NOT NULL,
  "event_type" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "status_code" integer,
  "response_body" text,
  "error" text,
  "attempt_number" integer,
  "delivered_at" timestamp,
  "duration" integer
);

-- pilot_checklist_items (8 columns)
CREATE TABLE IF NOT EXISTS "pilot_checklist_items" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "item_id" varchar(100) NOT NULL,
  "completed" boolean NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" varchar(255),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- pilot_demo_seeds (10 columns)
CREATE TABLE IF NOT EXISTS "pilot_demo_seeds" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "seeded_by" varchar(255),
  "seeded_at" timestamp with time zone NOT NULL,
  "purged_at" timestamp with time zone,
  "member_count" integer NOT NULL,
  "employer_count" integer NOT NULL,
  "grievance_count" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

-- federation_campaigns (42 columns)
CREATE TABLE IF NOT EXISTS "federation_campaigns" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "campaign_type" federation_campaign_type NOT NULL,
  "description" text,
  "start_date" date NOT NULL,
  "end_date" date,
  "target_completion_date" date,
  "target_sector" varchar(100),
  "target_employer" varchar(255),
  "target_region" varchar(100),
  "target_workers" integer,
  "goal_description" text,
  "workers_reached" integer,
  "workers_organized" integer,
  "cards_signed_count" integer,
  "events_held" integer,
  "volunteers_involved" integer,
  "status" varchar(20),
  "progress_percentage" integer,
  "lead_organizer_id" varchar(255),
  "lead_organizer_name" varchar(255),
  "coordinating_union_id" uuid,
  "participating_union_count" integer,
  "budget" numeric(12, 2),
  "actual_spend" numeric(12, 2),
  "currency" varchar(3),
  "is_public" boolean,
  "public_page_url" text,
  "social_media_hashtags" text,
  "success_level" varchar(20),
  "outcome_description" text,
  "lessons_learned" text,
  "resources_url" text,
  "report_url" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_communications (39 columns)
CREATE TABLE IF NOT EXISTS "federation_communications" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "communication_type" federation_communication_type NOT NULL,
  "subject" varchar(500),
  "content" text NOT NULL,
  "summary" text,
  "author_user_id" varchar(255),
  "author_name" varchar(255),
  "author_title" varchar(255),
  "status" varchar(20),
  "published_at" timestamp with time zone,
  "scheduled_for" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "send_to_all_members" boolean,
  "target_audience" varchar(100),
  "sent_count" integer,
  "delivered_count" integer,
  "opened_count" integer,
  "click_count" integer,
  "priority" varchar(20),
  "is_pinned" boolean,
  "is_public" boolean,
  "featured_image" text,
  "related_campaign_id" uuid,
  "related_meeting_id" uuid,
  "related_event_id" uuid,
  "attachments" jsonb,
  "call_to_action" varchar(255),
  "action_url" text,
  "action_button_text" varchar(100),
  "tags" text[],
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_executives (33 columns)
CREATE TABLE IF NOT EXISTS "federation_executives" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "profile_user_id" varchar(255) NOT NULL,
  "union_organization_id" uuid,
  "position" varchar(100) NOT NULL,
  "position_type" varchar(50) NOT NULL,
  "portfolio_area" varchar(100),
  "term_start" date NOT NULL,
  "term_end" date,
  "current_term" boolean,
  "term_number" integer,
  "elected_date" date,
  "election_type" varchar(50),
  "votes_received" integer,
  "executive_email" varchar(255),
  "executive_phone" varchar(50),
  "office_location" varchar(255),
  "signing_authority" boolean,
  "budget_authority" boolean,
  "can_approve_remittances" boolean,
  "can_manage_campaigns" boolean,
  "compensation_type" varchar(50),
  "compensation_amount" numeric(10, 2),
  "status" varchar(20),
  "is_active" boolean,
  "biography" text,
  "photo" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_meetings (37 columns)
CREATE TABLE IF NOT EXISTS "federation_meetings" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "meeting_type" federation_meeting_type NOT NULL,
  "description" text,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "timezone" varchar(50),
  "location_type" varchar(20),
  "venue_name" varchar(255),
  "venue_address" text,
  "virtual_meeting_url" text,
  "virtual_meeting_platform" varchar(50),
  "expected_attendees" integer,
  "actual_attendees" integer,
  "quorum_required" integer,
  "quorum_met" boolean,
  "status" varchar(20),
  "minutes_url" text,
  "recording_url" text,
  "resolutions_passed" integer,
  "decisions_url" text,
  "registration_required" boolean,
  "registration_deadline" timestamp with time zone,
  "registration_url" text,
  "max_capacity" integer,
  "agenda_url" text,
  "materials_url" text,
  "organizer_user_id" varchar(255),
  "organizer_name" varchar(255),
  "organizer_email" varchar(255),
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_memberships (34 columns)
CREATE TABLE IF NOT EXISTS "federation_memberships" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "union_organization_id" uuid NOT NULL,
  "status" federation_membership_status NOT NULL,
  "membership_number" varchar(100),
  "joined_date" date NOT NULL,
  "effective_date" date,
  "suspended_date" date,
  "terminated_date" date,
  "last_renewal_date" date,
  "next_renewal_date" date,
  "membership_type" varchar(50),
  "voting_rights" boolean,
  "executive_eligibility" boolean,
  "per_capita_rate" numeric(10, 4),
  "monthly_dues" numeric(10, 2),
  "currency" varchar(3),
  "dues_in_arrears" boolean,
  "arrears_amount" numeric(12, 2),
  "last_payment_date" date,
  "delegate_count" integer,
  "executive_seats" integer,
  "primary_contact_user_id" varchar(255),
  "primary_contact_name" varchar(255),
  "primary_contact_email" varchar(255),
  "primary_contact_phone" varchar(50),
  "suspension_reason" text,
  "termination_reason" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_remittances (46 columns)
CREATE TABLE IF NOT EXISTS "federation_remittances" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "from_organization_id" uuid NOT NULL,
  "to_organization_id" uuid NOT NULL,
  "membership_id" uuid,
  "per_capita_remittance_id" uuid,
  "remittance_month" integer NOT NULL,
  "remittance_year" integer NOT NULL,
  "period_start" date,
  "period_end" date,
  "due_date" date NOT NULL,
  "total_members" integer NOT NULL,
  "remittable_members" integer NOT NULL,
  "per_capita_rate" numeric(10, 4) NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "currency" varchar(3),
  "status" varchar(20),
  "payment_status" varchar(20),
  "amount_paid" numeric(12, 2),
  "amount_outstanding" numeric(12, 2),
  "paid_date" timestamp with time zone,
  "payment_method" varchar(50),
  "payment_reference" varchar(100),
  "cheque_number" varchar(50),
  "approval_status" varchar(20),
  "submitted_date" timestamp with time zone,
  "submitted_by" varchar(255),
  "approved_date" timestamp with time zone,
  "approved_by" varchar(255),
  "rejected_date" timestamp with time zone,
  "rejected_by" varchar(255),
  "rejection_reason" text,
  "invoice_url" text,
  "receipt_url" text,
  "remittance_file_url" text,
  "gl_account" varchar(50),
  "fiscal_period" varchar(20),
  "late_fee_amount" numeric(10, 2),
  "adjustment_amount" numeric(10, 2),
  "adjustment_reason" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- federation_resources (49 columns)
CREATE TABLE IF NOT EXISTS "federation_resources" (
  "id" uuid PRIMARY KEY,
  "federation_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "resource_type" federation_resource_type NOT NULL,
  "description" text,
  "category" varchar(100),
  "sub_category" varchar(100),
  "topics" text[],
  "target_audience" varchar(100),
  "skill_level" varchar(20),
  "file_url" text,
  "file_type" varchar(50),
  "file_size" integer,
  "thumbnail_url" text,
  "preview_url" text,
  "additional_files" jsonb,
  "version" varchar(20),
  "previous_version_id" uuid,
  "is_current_version" boolean,
  "status" varchar(20),
  "published_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "author_user_id" varchar(255),
  "author_name" varchar(255),
  "author_organization" varchar(255),
  "contributors" text[],
  "is_public" boolean,
  "access_level" varchar(50),
  "download_count" integer,
  "view_count" integer,
  "rating" numeric(3, 2),
  "rating_count" integer,
  "language" varchar(10),
  "available_languages" text[],
  "license" varchar(100),
  "license_url" text,
  "related_resource_ids" uuid[],
  "related_campaign_id" uuid,
  "tags" text[],
  "search_keywords" text,
  "notes" text,
  "usage_instructions" text,
  "credits" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "created_by" varchar(255),
  "updated_by" varchar(255)
);

-- org_configurations (9 columns)
CREATE TABLE IF NOT EXISTS "org_configurations" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "category" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb,
  "description" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "updated_by" uuid
);

-- org_usage (9 columns)
CREATE TABLE IF NOT EXISTS "org_usage" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL,
  "storage_used_bytes" integer NOT NULL,
  "document_count" integer NOT NULL,
  "api_call_count" integer NOT NULL,
  "last_calculated_at" timestamp with time zone,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone
);

-- ── MISSING COLUMNS (ALTER TABLE) ──
-- chart_of_accounts: +24 columns
ALTER TABLE "chart_of_accounts"
  ADD COLUMN "account_number" varchar(50),
  ADD COLUMN "account_name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "type" account_type,
  ADD COLUMN "sub_type" varchar(100),
  ADD COLUMN "parent_account_id" uuid,
  ADD COLUMN "status" account_status NOT NULL,
  ADD COLUMN "normal_balance" varchar(10),
  ADD COLUMN "is_sub_account" boolean,
  ADD COLUMN "allow_transactions" boolean,
  ADD COLUMN "require_cost_center" boolean,
  ADD COLUMN "require_department" boolean,
  ADD COLUMN "require_approval" boolean,
  ADD COLUMN "require_invoice" boolean,
  ADD COLUMN "is_reconciled_daily" boolean,
  ADD COLUMN "last_reconciled_at" timestamp,
  ADD COLUMN "last_reconciled_balance" numeric(19, 2),
  ADD COLUMN "gl_code" varchar(50),
  ADD COLUMN "sap_code" varchar(50),
  ADD COLUMN "quickbooks_code" varchar(50),
  ADD COLUMN "opening_balance" numeric(19, 2),
  ADD COLUMN "opening_balance_date" timestamp,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- corrective_actions: +54 columns
ALTER TABLE "corrective_actions"
  ADD COLUMN "source_type" varchar(50),
  ADD COLUMN "source_id" uuid,
  ADD COLUMN "source_reference" varchar(100),
  ADD COLUMN "action_type" varchar(50),
  ADD COLUMN "priority" corrective_action_priority NOT NULL,
  ADD COLUMN "status" corrective_action_status NOT NULL,
  ADD COLUMN "title" varchar(500),
  ADD COLUMN "description" text,
  ADD COLUMN "root_cause" text,
  ADD COLUMN "problem_statement" text,
  ADD COLUMN "immediate_actions" text,
  ADD COLUMN "proposed_action" text,
  ADD COLUMN "implementation_plan" text,
  ADD COLUMN "required_resources" text,
  ADD COLUMN "estimated_cost" numeric(12, 2),
  ADD COLUMN "actual_cost" numeric(12, 2),
  ADD COLUMN "assigned_to_id" uuid,
  ADD COLUMN "assigned_to_name" varchar(255),
  ADD COLUMN "assigned_date" timestamp with time zone,
  ADD COLUMN "responsible_person_id" uuid,
  ADD COLUMN "responsible_person_name" varchar(255),
  ADD COLUMN "identified_date" date,
  ADD COLUMN "due_date" date,
  ADD COLUMN "target_completion_date" date,
  ADD COLUMN "actual_completion_date" date,
  ADD COLUMN "verification_date" date,
  ADD COLUMN "closed_date" date,
  ADD COLUMN "progress_percentage" integer,
  ADD COLUMN "progress_notes" text,
  ADD COLUMN "milestones_updates" jsonb,
  ADD COLUMN "completion_notes" text,
  ADD COLUMN "completion_evidence" text,
  ADD COLUMN "verified_by_id" uuid,
  ADD COLUMN "verified_by_name" varchar(255),
  ADD COLUMN "verification_method" varchar(255),
  ADD COLUMN "verification_notes" text,
  ADD COLUMN "verification_passed" boolean,
  ADD COLUMN "effectiveness_review_required" boolean,
  ADD COLUMN "effectiveness_review_date" date,
  ADD COLUMN "effectiveness_reviewed_by" varchar(255),
  ADD COLUMN "effectiveness_rating" varchar(50),
  ADD COLUMN "effectiveness_notes" text,
  ADD COLUMN "preventive_measures" text,
  ADD COLUMN "system_changes_required" boolean,
  ADD COLUMN "system_changes_description" text,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "notifications_sent" jsonb,
  ADD COLUMN "reminders_sent" integer,
  ADD COLUMN "last_reminder_date" timestamp with time zone,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- gl_account_mappings: +14 columns
ALTER TABLE "gl_account_mappings"
  ADD COLUMN "chart_of_accounts_id" uuid,
  ADD COLUMN "local_account_type" varchar(100),
  ADD COLUMN "local_transaction_type" varchar(100),
  ADD COLUMN "gl_account_number" varchar(50),
  ADD COLUMN "gl_department" varchar(50),
  ADD COLUMN "gl_cost_center" varchar(50),
  ADD COLUMN "erp_system_code" varchar(50),
  ADD COLUMN "erp_account_code" varchar(100),
  ADD COLUMN "debit_account" varchar(50),
  ADD COLUMN "credit_account" varchar(50),
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "valid_from" timestamp,
  ADD COLUMN "valid_to" timestamp,
  ADD COLUMN "created_by" varchar(255);

-- hazard_reports: +45 columns
ALTER TABLE "hazard_reports"
  ADD COLUMN "hazard_category" hazard_category,
  ADD COLUMN "hazard_level" hazard_level,
  ADD COLUMN "reported_date" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "hazard_date" timestamp with time zone,
  ADD COLUMN "workplace_id" uuid,
  ADD COLUMN "workplace_name" varchar(255),
  ADD COLUMN "department" varchar(255),
  ADD COLUMN "specific_location" text,
  ADD COLUMN "reported_by_id" uuid,
  ADD COLUMN "reported_by_name" varchar(255),
  ADD COLUMN "is_anonymous" boolean,
  ADD COLUMN "reporter_contact_info" varchar(255),
  ADD COLUMN "hazard_description" text,
  ADD COLUMN "who_is_at_risk" text,
  ADD COLUMN "potential_consequences" text,
  ADD COLUMN "existing_controls" text,
  ADD COLUMN "suggested_corrections" text,
  ADD COLUMN "risk_assessment_completed" boolean,
  ADD COLUMN "risk_assessment_date" timestamp with time zone,
  ADD COLUMN "risk_assessor_id" uuid,
  ADD COLUMN "risk_assessor_name" varchar(255),
  ADD COLUMN "likelihood_score" integer,
  ADD COLUMN "severity_score" integer,
  ADD COLUMN "risk_score" integer,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "assigned_to_id" uuid,
  ADD COLUMN "assigned_to_name" varchar(255),
  ADD COLUMN "assigned_date" timestamp with time zone,
  ADD COLUMN "resolution_date" timestamp with time zone,
  ADD COLUMN "resolution_description" text,
  ADD COLUMN "resolution_cost" numeric(12, 2),
  ADD COLUMN "verified_by_id" uuid,
  ADD COLUMN "verified_by_name" varchar(255),
  ADD COLUMN "verified_date" timestamp with time zone,
  ADD COLUMN "verification_notes" text,
  ADD COLUMN "closed_date" timestamp with time zone,
  ADD COLUMN "corrective_action_required" boolean,
  ADD COLUMN "corrective_action_ids" jsonb,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "photo_urls" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- injury_logs: +62 columns
ALTER TABLE "injury_logs"
  ADD COLUMN "incident_id" uuid,
  ADD COLUMN "claim_id" uuid,
  ADD COLUMN "worker_id" uuid,
  ADD COLUMN "worker_name" varchar(255),
  ADD COLUMN "worker_employee_id" varchar(100),
  ADD COLUMN "worker_date_of_birth" date,
  ADD COLUMN "worker_job_title" varchar(255),
  ADD COLUMN "worker_department" varchar(255),
  ADD COLUMN "worker_hire_date" date,
  ADD COLUMN "injury_date" date,
  ADD COLUMN "injury_time" varchar(20),
  ADD COLUMN "reported_date" date,
  ADD COLUMN "body_parts_affected" jsonb,
  ADD COLUMN "injury_types" jsonb,
  ADD COLUMN "injury_severity" incident_severity,
  ADD COLUMN "first_aid_provided" boolean,
  ADD COLUMN "first_aid_description" text,
  ADD COLUMN "medical_attention_required" boolean,
  ADD COLUMN "treated_at_location" varchar(255),
  ADD COLUMN "treating_physician" varchar(255),
  ADD COLUMN "hospital_name" varchar(255),
  ADD COLUMN "hospitalized" boolean,
  ADD COLUMN "hospitalization_days" integer,
  ADD COLUMN "lost_time_injury" boolean,
  ADD COLUMN "first_day_missed" date,
  ADD COLUMN "return_to_work_date" date,
  ADD COLUMN "days_away" integer,
  ADD COLUMN "days_restricted" integer,
  ADD COLUMN "days_transferred" integer,
  ADD COLUMN "modified_duties_assigned" boolean,
  ADD COLUMN "modified_duties_description" text,
  ADD COLUMN "permanent_impairment" boolean,
  ADD COLUMN "impairment_description" text,
  ADD COLUMN "impairment_rating_percentage" numeric(5, 2),
  ADD COLUMN "wsib_claim_filed" boolean,
  ADD COLUMN "wsib_claim_number" varchar(100),
  ADD COLUMN "wsib_claim_date" date,
  ADD COLUMN "wsib_claim_status" varchar(100),
  ADD COLUMN "wsib_decision" varchar(255),
  ADD COLUMN "wsib_decision_date" date,
  ADD COLUMN "benefits_approved" boolean,
  ADD COLUMN "benefit_start_date" date,
  ADD COLUMN "benefit_amount" numeric(12, 2),
  ADD COLUMN "medical_costs" numeric(12, 2),
  ADD COLUMN "wage_loss_costs" numeric(12, 2),
  ADD COLUMN "rehabilitation_costs" numeric(12, 2),
  ADD COLUMN "total_costs" numeric(12, 2),
  ADD COLUMN "osha_recordable" boolean,
  ADD COLUMN "osha_form_number" varchar(50),
  ADD COLUMN "osha_classification" varchar(100),
  ADD COLUMN "provincial_report_required" boolean,
  ADD COLUMN "provincial_report_filed" boolean,
  ADD COLUMN "provincial_report_number" varchar(100),
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "medical_records" jsonb,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "closed_date" date,
  ADD COLUMN "closure_notes" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- ml_predictions: +6 columns
ALTER TABLE "ml_predictions"
  ADD COLUMN "prediction_date" timestamp,
  ADD COLUMN "lower_bound" numeric,
  ADD COLUMN "upper_bound" numeric,
  ADD COLUMN "confidence" numeric,
  ADD COLUMN "horizon" integer,
  ADD COLUMN "granularity" varchar(20);

-- ppe_equipment: +47 columns
ALTER TABLE "ppe_equipment"
  ADD COLUMN "serial_number" varchar(100),
  ADD COLUMN "ppe_type" ppe_type,
  ADD COLUMN "item_name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "manufacturer" varchar(255),
  ADD COLUMN "model" varchar(255),
  ADD COLUMN "size" varchar(50),
  ADD COLUMN "status" ppe_status NOT NULL,
  ADD COLUMN "storage_location" varchar(255),
  ADD COLUMN "quantity_in_stock" integer,
  ADD COLUMN "quantity_issued" integer,
  ADD COLUMN "reorder_level" integer,
  ADD COLUMN "reorder_quantity" integer,
  ADD COLUMN "issued_to_id" uuid,
  ADD COLUMN "issued_to_name" varchar(255),
  ADD COLUMN "issued_date" date,
  ADD COLUMN "issued_by_id" uuid,
  ADD COLUMN "issued_by_name" varchar(255),
  ADD COLUMN "returned_date" date,
  ADD COLUMN "return_condition" varchar(100),
  ADD COLUMN "purchase_date" date,
  ADD COLUMN "purchase_cost" numeric(10, 2),
  ADD COLUMN "supplier" varchar(255),
  ADD COLUMN "purchase_order_number" varchar(100),
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "inspection_required" boolean,
  ADD COLUMN "last_inspection_date" date,
  ADD COLUMN "next_inspection_date" date,
  ADD COLUMN "inspection_frequency_days" integer,
  ADD COLUMN "maintenance_required" boolean,
  ADD COLUMN "last_maintenance_date" date,
  ADD COLUMN "next_maintenance_date" date,
  ADD COLUMN "maintenance_notes" text,
  ADD COLUMN "certification_standard" varchar(255),
  ADD COLUMN "certification_number" varchar(100),
  ADD COLUMN "csa_approved" boolean,
  ADD COLUMN "ansi_approved" boolean,
  ADD COLUMN "disposal_date" date,
  ADD COLUMN "disposal_reason" varchar(255),
  ADD COLUMN "disposal_method" varchar(255),
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "manual_url" text,
  ADD COLUMN "certification_url" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_audits: +55 columns
ALTER TABLE "safety_audits"
  ADD COLUMN "audit_type" audit_type,
  ADD COLUMN "status" audit_status NOT NULL,
  ADD COLUMN "planned_date" date,
  ADD COLUMN "scheduled_start_date" date,
  ADD COLUMN "scheduled_end_date" date,
  ADD COLUMN "actual_start_date" date,
  ADD COLUMN "actual_end_date" date,
  ADD COLUMN "audit_scope" text,
  ADD COLUMN "audit_objectives" text,
  ADD COLUMN "standards_referenced" jsonb,
  ADD COLUMN "workplace_ids" jsonb,
  ADD COLUMN "workplace_names" jsonb,
  ADD COLUMN "departments_audited" jsonb,
  ADD COLUMN "lead_auditor_id" uuid,
  ADD COLUMN "lead_auditor_name" varchar(255),
  ADD COLUMN "lead_auditor_certification" varchar(255),
  ADD COLUMN "auditor_ids" jsonb,
  ADD COLUMN "auditor_names" jsonb,
  ADD COLUMN "is_external_audit" boolean,
  ADD COLUMN "auditing_organization" varchar(255),
  ADD COLUMN "audit_plan" text,
  ADD COLUMN "documents_reviewed" jsonb,
  ADD COLUMN "areas_inspected" jsonb,
  ADD COLUMN "staff_interviewed" jsonb,
  ADD COLUMN "total_findings" integer,
  ADD COLUMN "critical_findings" integer,
  ADD COLUMN "major_findings" integer,
  ADD COLUMN "minor_findings" integer,
  ADD COLUMN "observations" integer,
  ADD COLUMN "findings_detail" jsonb,
  ADD COLUMN "overall_compliance_rating" varchar(50),
  ADD COLUMN "compliance_percentage" numeric(5, 2),
  ADD COLUMN "strengths" text,
  ADD COLUMN "weaknesses" text,
  ADD COLUMN "opportunities_for_improvement" text,
  ADD COLUMN "executive_summary" text,
  ADD COLUMN "audit_report" text,
  ADD COLUMN "report_url" text,
  ADD COLUMN "report_issue_date" date,
  ADD COLUMN "corrective_actions_required" boolean,
  ADD COLUMN "corrective_action_plan" text,
  ADD COLUMN "corrective_action_ids" jsonb,
  ADD COLUMN "follow_up_audit_required" boolean,
  ADD COLUMN "follow_up_audit_date" date,
  ADD COLUMN "follow_up_completed" boolean,
  ADD COLUMN "certification_awarded" boolean,
  ADD COLUMN "certification_type" varchar(255),
  ADD COLUMN "certificate_number" varchar(100),
  ADD COLUMN "certification_valid_from" date,
  ADD COLUMN "certification_valid_until" date,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_certifications: +52 columns
ALTER TABLE "safety_certifications"
  ADD COLUMN "holder_id" uuid,
  ADD COLUMN "holder_name" varchar(255),
  ADD COLUMN "holder_employee_id" varchar(100),
  ADD COLUMN "holder_job_title" varchar(255),
  ADD COLUMN "holder_department" varchar(255),
  ADD COLUMN "certification_type" safety_certification_type,
  ADD COLUMN "certification_name" varchar(300),
  ADD COLUMN "certification_level" varchar(100),
  ADD COLUMN "issuing_organization" varchar(255),
  ADD COLUMN "issuing_body" varchar(255),
  ADD COLUMN "certification_standard" varchar(255),
  ADD COLUMN "certificate_number" varchar(100),
  ADD COLUMN "issue_date" date,
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "validity_period_years" integer,
  ADD COLUMN "status" certification_status NOT NULL,
  ADD COLUMN "renewal_required" boolean,
  ADD COLUMN "renewal_date" date,
  ADD COLUMN "renewal_in_progress" boolean,
  ADD COLUMN "renewal_application_date" date,
  ADD COLUMN "reminder_sent_date" date,
  ADD COLUMN "reminder_frequency_days" integer,
  ADD COLUMN "training_record_id" uuid,
  ADD COLUMN "course_id" uuid,
  ADD COLUMN "training_completed_date" date,
  ADD COLUMN "examination_required" boolean,
  ADD COLUMN "examination_date" date,
  ADD COLUMN "examination_score" numeric(5, 2),
  ADD COLUMN "examination_passed" boolean,
  ADD COLUMN "competency_assessed" boolean,
  ADD COLUMN "competency_level" varchar(50),
  ADD COLUMN "competency_assessment_date" date,
  ADD COLUMN "authorized_activities" jsonb,
  ADD COLUMN "restrictions" text,
  ADD COLUMN "regulatory_requirement" boolean,
  ADD COLUMN "legislation_reference" varchar(500),
  ADD COLUMN "compliance_notes" text,
  ADD COLUMN "suspended_date" date,
  ADD COLUMN "suspension_reason" text,
  ADD COLUMN "revoked_date" date,
  ADD COLUMN "revocation_reason" text,
  ADD COLUMN "reinstatement_date" date,
  ADD COLUMN "reinstatement_conditions" text,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "certificate_url" text,
  ADD COLUMN "continuing_education_required" boolean,
  ADD COLUMN "continuing_education_hours_required" integer,
  ADD COLUMN "continuing_education_hours_completed" integer,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_committee_meetings: +50 columns
ALTER TABLE "safety_committee_meetings"
  ADD COLUMN "meeting_type" meeting_type NOT NULL,
  ADD COLUMN "meeting_date" timestamp with time zone,
  ADD COLUMN "start_time" timestamp with time zone,
  ADD COLUMN "end_time" timestamp with time zone,
  ADD COLUMN "duration_minutes" integer,
  ADD COLUMN "location" varchar(255),
  ADD COLUMN "is_virtual" boolean,
  ADD COLUMN "meeting_link" text,
  ADD COLUMN "committee_name" varchar(255),
  ADD COLUMN "chairperson_id" uuid,
  ADD COLUMN "chairperson_name" varchar(255),
  ADD COLUMN "secretary_id" uuid,
  ADD COLUMN "secretary_name" varchar(255),
  ADD COLUMN "member_ids" jsonb,
  ADD COLUMN "member_names" jsonb,
  ADD COLUMN "attendee_ids" jsonb,
  ADD COLUMN "attendee_names" jsonb,
  ADD COLUMN "absent_ids" jsonb,
  ADD COLUMN "absent_names" jsonb,
  ADD COLUMN "guest_ids" jsonb,
  ADD COLUMN "guest_names" jsonb,
  ADD COLUMN "quorum_met" boolean,
  ADD COLUMN "attendance_count" integer,
  ADD COLUMN "agenda" text,
  ADD COLUMN "agenda_items" jsonb,
  ADD COLUMN "minutes" text,
  ADD COLUMN "discussion_summary" text,
  ADD COLUMN "key_points" jsonb,
  ADD COLUMN "previous_minutes_approved" boolean,
  ADD COLUMN "action_items_reviewed" boolean,
  ADD COLUMN "action_items_from_previous" jsonb,
  ADD COLUMN "incidents_reviewed" jsonb,
  ADD COLUMN "hazards_reviewed" jsonb,
  ADD COLUMN "inspections_reviewed" jsonb,
  ADD COLUMN "action_items_created" jsonb,
  ADD COLUMN "recommendations" text,
  ADD COLUMN "training_needs" text,
  ADD COLUMN "policy_reviews" text,
  ADD COLUMN "next_meeting_date" timestamp with time zone,
  ADD COLUMN "next_meeting_agenda" text,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "minutes_document_id" uuid,
  ADD COLUMN "recording_url" text,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "minutes_approved" boolean,
  ADD COLUMN "minutes_approved_date" timestamp with time zone,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_inspections: +47 columns
ALTER TABLE "safety_inspections"
  ADD COLUMN "inspection_type" inspection_type,
  ADD COLUMN "status" inspection_status NOT NULL,
  ADD COLUMN "scheduled_date" timestamp with time zone,
  ADD COLUMN "started_date" timestamp with time zone,
  ADD COLUMN "completed_date" timestamp with time zone,
  ADD COLUMN "due_date" timestamp with time zone,
  ADD COLUMN "workplace_id" uuid,
  ADD COLUMN "workplace_name" varchar(255),
  ADD COLUMN "areas_inspected" jsonb,
  ADD COLUMN "specific_location" text,
  ADD COLUMN "lead_inspector_id" uuid,
  ADD COLUMN "lead_inspector_name" varchar(255),
  ADD COLUMN "inspector_ids" jsonb,
  ADD COLUMN "inspector_names" jsonb,
  ADD COLUMN "inspection_scope" text,
  ADD COLUMN "checklist_used" varchar(255),
  ADD COLUMN "checklist_items" jsonb,
  ADD COLUMN "total_items_checked" integer,
  ADD COLUMN "items_passed" integer,
  ADD COLUMN "items_failed" integer,
  ADD COLUMN "items_requiring_attention" integer,
  ADD COLUMN "hazards_identified" integer,
  ADD COLUMN "critical_hazards" integer,
  ADD COLUMN "overall_rating" varchar(50),
  ADD COLUMN "score_percentage" numeric(5, 2),
  ADD COLUMN "findings" text,
  ADD COLUMN "observations" text,
  ADD COLUMN "positive_findings" text,
  ADD COLUMN "areas_of_concern" text,
  ADD COLUMN "recommendations" text,
  ADD COLUMN "immediate_action_required" boolean,
  ADD COLUMN "corrective_actions_required" boolean,
  ADD COLUMN "follow_up_required" boolean,
  ADD COLUMN "follow_up_date" timestamp with time zone,
  ADD COLUMN "follow_up_completed" boolean,
  ADD COLUMN "follow_up_notes" text,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "photo_urls" jsonb,
  ADD COLUMN "report_url" text,
  ADD COLUMN "regulatory_requirement" boolean,
  ADD COLUMN "regulatory_agency" varchar(255),
  ADD COLUMN "regulatory_reference" varchar(255),
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_policies: +50 columns
ALTER TABLE "safety_policies"
  ADD COLUMN "policy_title" varchar(500),
  ADD COLUMN "policy_category" varchar(100),
  ADD COLUMN "policy_type" varchar(100),
  ADD COLUMN "policy_description" text,
  ADD COLUMN "purpose" text,
  ADD COLUMN "scope" text,
  ADD COLUMN "applicability" text,
  ADD COLUMN "responsibilities" text,
  ADD COLUMN "procedures" text,
  ADD COLUMN "definitions" jsonb,
  ADD COLUMN "references" text,
  ADD COLUMN "document_id" uuid,
  ADD COLUMN "document_url" text,
  ADD COLUMN "version" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "revision_history" jsonb,
  ADD COLUMN "effective_date" date,
  ADD COLUMN "review_date" date,
  ADD COLUMN "next_review_date" date,
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "review_frequency_months" integer,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "drafted_by_id" uuid,
  ADD COLUMN "drafted_by_name" varchar(255),
  ADD COLUMN "drafted_date" date,
  ADD COLUMN "reviewed_by_id" uuid,
  ADD COLUMN "reviewed_by_name" varchar(255),
  ADD COLUMN "reviewed_date" date,
  ADD COLUMN "review_comments" text,
  ADD COLUMN "approved_by_id" uuid,
  ADD COLUMN "approved_by_name" varchar(255),
  ADD COLUMN "approval_date" date,
  ADD COLUMN "approval_comments" text,
  ADD COLUMN "regulatory_requirement" boolean,
  ADD COLUMN "regulatory_reference" varchar(500),
  ADD COLUMN "legislation_citation" text,
  ADD COLUMN "training_required" boolean,
  ADD COLUMN "training_course_ids" jsonb,
  ADD COLUMN "communication_plan" text,
  ADD COLUMN "affected_employees" jsonb,
  ADD COLUMN "affected_departments" jsonb,
  ADD COLUMN "acknowledgement_required" boolean,
  ADD COLUMN "acknowledged_by" jsonb,
  ADD COLUMN "related_policy_ids" jsonb,
  ADD COLUMN "superseded_policy_ids" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "keywords" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- safety_training_records: +42 columns
ALTER TABLE "safety_training_records"
  ADD COLUMN "course_id" uuid,
  ADD COLUMN "course_name" varchar(300),
  ADD COLUMN "course_code" varchar(50),
  ADD COLUMN "course_category" varchar(100),
  ADD COLUMN "training_provider" varchar(255),
  ADD COLUMN "trainee_id" uuid,
  ADD COLUMN "trainee_name" varchar(255),
  ADD COLUMN "trainee_employee_id" varchar(100),
  ADD COLUMN "trainee_job_title" varchar(255),
  ADD COLUMN "trainee_department" varchar(255),
  ADD COLUMN "training_date" date,
  ADD COLUMN "completion_date" date,
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "validity_period_months" integer,
  ADD COLUMN "status" training_status NOT NULL,
  ADD COLUMN "instructor_id" uuid,
  ADD COLUMN "instructor_name" varchar(255),
  ADD COLUMN "instructor_certification" varchar(255),
  ADD COLUMN "delivery_method" varchar(50),
  ADD COLUMN "training_location" varchar(255),
  ADD COLUMN "duration_hours" numeric(5, 2),
  ADD COLUMN "assessment_required" boolean,
  ADD COLUMN "assessment_score" numeric(5, 2),
  ADD COLUMN "passing_score" numeric(5, 2),
  ADD COLUMN "passed" boolean,
  ADD COLUMN "certificate_issued" boolean,
  ADD COLUMN "certificate_number" varchar(100),
  ADD COLUMN "certificate_url" text,
  ADD COLUMN "regulatory_requirement" boolean,
  ADD COLUMN "regulatory_body" varchar(255),
  ADD COLUMN "compliance_reference" varchar(255),
  ADD COLUMN "is_mandatory" boolean,
  ADD COLUMN "renewal_required" boolean,
  ADD COLUMN "renewal_date" date,
  ADD COLUMN "renewal_reminder_sent" boolean,
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "training_cost" numeric(10, 2),
  ADD COLUMN "cost_covered_by_employer" boolean,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- workplace_incidents: +70 columns
ALTER TABLE "workplace_incidents"
  ADD COLUMN "claim_id" uuid,
  ADD COLUMN "incident_type" incident_type,
  ADD COLUMN "severity" incident_severity,
  ADD COLUMN "incident_date" timestamp with time zone,
  ADD COLUMN "reported_date" timestamp with time zone,
  ADD COLUMN "location_description" text,
  ADD COLUMN "workplace_id" uuid,
  ADD COLUMN "workplace_name" varchar(255),
  ADD COLUMN "department_name" varchar(255),
  ADD COLUMN "injured_person_id" uuid,
  ADD COLUMN "injured_person_name" varchar(255),
  ADD COLUMN "injured_person_job_title" varchar(255),
  ADD COLUMN "injured_person_employee_id" varchar(100),
  ADD COLUMN "body_part_affected" body_part,
  ADD COLUMN "injury_nature" injury_nature,
  ADD COLUMN "treatment_provided" text,
  ADD COLUMN "treatment_location" varchar(255),
  ADD COLUMN "hospitalized_days" integer,
  ADD COLUMN "lost_time_days" integer,
  ADD COLUMN "restricted_work_days" integer,
  ADD COLUMN "description" text,
  ADD COLUMN "what_happened" text,
  ADD COLUMN "task_being_performed" text,
  ADD COLUMN "equipment_involved" text,
  ADD COLUMN "materials_involved" text,
  ADD COLUMN "lighting_condition" varchar(100),
  ADD COLUMN "weather_condition" varchar(100),
  ADD COLUMN "temperature_condition" varchar(100),
  ADD COLUMN "witnesses_present" boolean,
  ADD COLUMN "witness_names" jsonb,
  ADD COLUMN "witness_statements" jsonb,
  ADD COLUMN "reported_by_id" uuid,
  ADD COLUMN "reported_by_name" varchar(255),
  ADD COLUMN "reported_by_job_title" varchar(255),
  ADD COLUMN "supervisor_notified_id" uuid,
  ADD COLUMN "supervisor_notified_name" varchar(255),
  ADD COLUMN "supervisor_notified_date" timestamp with time zone,
  ADD COLUMN "investigation_required" boolean,
  ADD COLUMN "investigation_start_date" timestamp with time zone,
  ADD COLUMN "investigation_completed_date" timestamp with time zone,
  ADD COLUMN "investigator_id" uuid,
  ADD COLUMN "investigator_name" varchar(255),
  ADD COLUMN "investigation_report" text,
  ADD COLUMN "root_cause_analysis" text,
  ADD COLUMN "contributing_factors" jsonb,
  ADD COLUMN "immediate_actions_taken" text,
  ADD COLUMN "corrective_actions_required" boolean,
  ADD COLUMN "corrective_actions_summary" text,
  ADD COLUMN "reportable_to_authority" boolean,
  ADD COLUMN "authority_notified" boolean,
  ADD COLUMN "authority_name" varchar(255),
  ADD COLUMN "authority_report_number" varchar(100),
  ADD COLUMN "authority_report_date" timestamp with time zone,
  ADD COLUMN "wsib_claim_number" varchar(100),
  ADD COLUMN "wsib_claim_status" varchar(50),
  ADD COLUMN "wsib_claim_amount" numeric(12, 2),
  ADD COLUMN "document_ids" jsonb,
  ADD COLUMN "photo_urls" jsonb,
  ADD COLUMN "video_urls" jsonb,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "closed_date" timestamp with time zone,
  ADD COLUMN "closure_notes" text,
  ADD COLUMN "preventability_assessment" text,
  ADD COLUMN "lessons_learned" text,
  ADD COLUMN "training_recommended" boolean,
  ADD COLUMN "training_recommendations" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "created_by" uuid,
  ADD COLUMN "updated_by" uuid;

-- organization_users: +2 columns
ALTER TABLE "user_management"."organization_users"
  ADD COLUMN "invited_at" timestamp with time zone,
  ADD COLUMN "last_access_at" timestamp with time zone;

-- grievance_deadlines: +9 columns
ALTER TABLE "grievance_deadlines"
  ADD COLUMN "description" varchar(500),
  ADD COLUMN "due_date" timestamp with time zone,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "extension_granted" boolean,
  ADD COLUMN "new_deadline" timestamp with time zone,
  ADD COLUMN "reminder_days" integer[],
  ADD COLUMN "reminders_sent" jsonb,
  ADD COLUMN "notes" text;

-- grievance_documents: +27 columns
ALTER TABLE "grievance_documents"
  ADD COLUMN "document_type" varchar(100),
  ADD COLUMN "file_path" text,
  ADD COLUMN "file_size" bigint,
  ADD COLUMN "mime_type" varchar(100),
  ADD COLUMN "version" integer,
  ADD COLUMN "parent_document_id" uuid,
  ADD COLUMN "is_latest_version" boolean,
  ADD COLUMN "version_status" document_version_status,
  ADD COLUMN "description" text,
  ADD COLUMN "tags" text[],
  ADD COLUMN "category" varchar(100),
  ADD COLUMN "is_confidential" boolean,
  ADD COLUMN "access_level" varchar(50),
  ADD COLUMN "requires_signature" boolean,
  ADD COLUMN "signature_status" varchar(50),
  ADD COLUMN "signed_by" varchar(255),
  ADD COLUMN "signed_at" timestamp with time zone,
  ADD COLUMN "signature_data" jsonb,
  ADD COLUMN "ocr_text" text,
  ADD COLUMN "indexed" boolean,
  ADD COLUMN "uploaded_by" varchar(255),
  ADD COLUMN "uploaded_at" timestamp with time zone,
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "reviewed_at" timestamp with time zone,
  ADD COLUMN "retention_period_days" integer,
  ADD COLUMN "archived_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb;

-- claim_updates: +6 columns
ALTER TABLE "claim_updates"
  ADD COLUMN "update_type" varchar(50),
  ADD COLUMN "message" text,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "is_internal" boolean,
  ADD COLUMN "visibility_scope" visibility_scope NOT NULL,
  ADD COLUMN "metadata" jsonb;

-- grievance_timeline: +1 columns
ALTER TABLE "grievance_timeline"
  ADD COLUMN "created_by" uuid;

-- deadline_alerts: +17 columns
ALTER TABLE "deadline_alerts"
  ADD COLUMN "alert_type" varchar(100),
  ADD COLUMN "alert_severity" alert_severity,
  ADD COLUMN "alert_trigger" varchar(100),
  ADD COLUMN "recipient_id" varchar(255),
  ADD COLUMN "recipient_role" varchar(100),
  ADD COLUMN "delivery_method" delivery_method,
  ADD COLUMN "sent_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "delivered_at" timestamp,
  ADD COLUMN "delivery_status" delivery_status NOT NULL,
  ADD COLUMN "delivery_error" text,
  ADD COLUMN "viewed_at" timestamp,
  ADD COLUMN "acknowledged_at" timestamp,
  ADD COLUMN "action_taken" varchar(255),
  ADD COLUMN "action_taken_at" timestamp,
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "message" text,
  ADD COLUMN "action_url" varchar(500);

-- deadline_extensions: +11 columns
ALTER TABLE "deadline_extensions"
  ADD COLUMN "requested_by" varchar(255),
  ADD COLUMN "requested_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "requested_days" integer,
  ADD COLUMN "request_reason" text,
  ADD COLUMN "status" extension_status NOT NULL,
  ADD COLUMN "requires_approval" boolean NOT NULL DEFAULT false,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approval_decision_at" timestamp,
  ADD COLUMN "approval_notes" text,
  ADD COLUMN "new_deadline" timestamp,
  ADD COLUMN "days_granted" integer;

-- deadline_rules: +16 columns
ALTER TABLE "deadline_rules"
  ADD COLUMN "rule_name" varchar(255),
  ADD COLUMN "rule_code" varchar(100),
  ADD COLUMN "description" text,
  ADD COLUMN "claim_type" varchar(100),
  ADD COLUMN "priority_level" varchar(50),
  ADD COLUMN "step_number" integer,
  ADD COLUMN "days_from_event" integer,
  ADD COLUMN "event_type" varchar(100) NOT NULL DEFAULT '',
  ADD COLUMN "business_days_only" boolean NOT NULL DEFAULT false,
  ADD COLUMN "allows_extension" boolean NOT NULL DEFAULT false,
  ADD COLUMN "max_extension_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "requires_approval" boolean NOT NULL DEFAULT false,
  ADD COLUMN "escalate_to_role" varchar(100),
  ADD COLUMN "escalation_delay_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN "is_system_rule" boolean NOT NULL DEFAULT false;

-- claim_deadlines: +22 columns
ALTER TABLE "claim_deadlines"
  ADD COLUMN "deadline_rule_id" uuid,
  ADD COLUMN "deadline_name" varchar(255),
  ADD COLUMN "deadline_type" varchar(100),
  ADD COLUMN "event_date" timestamp,
  ADD COLUMN "original_deadline" timestamp,
  ADD COLUMN "due_date" timestamp,
  ADD COLUMN "completed_at" timestamp,
  ADD COLUMN "status" deadline_status NOT NULL,
  ADD COLUMN "priority" deadline_priority NOT NULL,
  ADD COLUMN "extension_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "total_extension_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_extension_date" timestamp,
  ADD COLUMN "last_extension_reason" text,
  ADD COLUMN "completed_by" varchar(255),
  ADD COLUMN "completion_notes" text,
  ADD COLUMN "is_overdue" boolean NOT NULL DEFAULT false,
  ADD COLUMN "days_until_due" integer,
  ADD COLUMN "days_overdue" integer NOT NULL DEFAULT 0,
  ADD COLUMN "escalated_at" timestamp,
  ADD COLUMN "escalated_to" varchar(255),
  ADD COLUMN "alert_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_alert_sent" timestamp;

-- grievance_approvals: +7 columns
ALTER TABLE "grievance_approvals"
  ADD COLUMN "approver_user_id" varchar(255),
  ADD COLUMN "approver_role" varchar(50),
  ADD COLUMN "action" varchar(20),
  ADD COLUMN "reviewed_at" timestamp with time zone,
  ADD COLUMN "comment" text,
  ADD COLUMN "rejection_reason" text,
  ADD COLUMN "metadata" jsonb;

-- grievance_assignments: +11 columns
ALTER TABLE "grievance_assignments"
  ADD COLUMN "role" assignment_role,
  ADD COLUMN "status" assignment_status,
  ADD COLUMN "assigned_by" varchar(255),
  ADD COLUMN "assigned_at" timestamp with time zone,
  ADD COLUMN "accepted_at" timestamp with time zone,
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "estimated_hours" numeric(10, 2),
  ADD COLUMN "actual_hours" numeric(10, 2),
  ADD COLUMN "assignment_reason" text,
  ADD COLUMN "notes" text,
  ADD COLUMN "metadata" jsonb;

-- grievance_communications: +20 columns
ALTER TABLE "grievance_communications"
  ADD COLUMN "direction" varchar(20),
  ADD COLUMN "from_user_id" varchar(255),
  ADD COLUMN "from_external" varchar(255),
  ADD COLUMN "to_user_ids" varchar(255)[],
  ADD COLUMN "to_external" varchar(255)[],
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "body" text,
  ADD COLUMN "summary" text,
  ADD COLUMN "communication_date" timestamp with time zone,
  ADD COLUMN "duration_minutes" integer,
  ADD COLUMN "attachment_ids" uuid[],
  ADD COLUMN "email_message_id" varchar(255),
  ADD COLUMN "sms_message_id" uuid,
  ADD COLUMN "calendar_event_id" uuid,
  ADD COLUMN "is_important" boolean,
  ADD COLUMN "requires_followup" boolean,
  ADD COLUMN "followup_date" date,
  ADD COLUMN "followup_completed" boolean,
  ADD COLUMN "recorded_by" varchar(255),
  ADD COLUMN "metadata" jsonb;

-- grievance_settlements: +32 columns
ALTER TABLE "grievance_settlements"
  ADD COLUMN "status" settlement_status,
  ADD COLUMN "monetary_amount" numeric(15, 2),
  ADD COLUMN "currency" varchar(3),
  ADD COLUMN "payment_schedule" jsonb,
  ADD COLUMN "terms_description" text,
  ADD COLUMN "terms_structured" jsonb,
  ADD COLUMN "proposed_by" varchar(50),
  ADD COLUMN "proposed_by_user" varchar(255),
  ADD COLUMN "proposed_at" timestamp with time zone,
  ADD COLUMN "responded_by" varchar(50),
  ADD COLUMN "responded_by_user" varchar(255),
  ADD COLUMN "responded_at" timestamp with time zone,
  ADD COLUMN "response_notes" text,
  ADD COLUMN "requires_member_approval" boolean,
  ADD COLUMN "member_approved" boolean,
  ADD COLUMN "member_approved_at" timestamp with time zone,
  ADD COLUMN "requires_union_approval" boolean,
  ADD COLUMN "union_approved" boolean,
  ADD COLUMN "union_approved_by" varchar(255),
  ADD COLUMN "union_approved_at" timestamp with time zone,
  ADD COLUMN "requires_management_approval" boolean,
  ADD COLUMN "management_approved" boolean,
  ADD COLUMN "management_approved_by" varchar(255),
  ADD COLUMN "management_approved_at" timestamp with time zone,
  ADD COLUMN "finalized_at" timestamp with time zone,
  ADD COLUMN "finalized_by" varchar(255),
  ADD COLUMN "settlement_document_id" uuid,
  ADD COLUMN "signed_agreement_id" uuid,
  ADD COLUMN "set_precedent" boolean,
  ADD COLUMN "precedent_description" text,
  ADD COLUMN "notes" text,
  ADD COLUMN "metadata" jsonb;

-- grievance_stages: +16 columns
ALTER TABLE "grievance_stages"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "stage_type" grievance_stage_type,
  ADD COLUMN "description" text,
  ADD COLUMN "order_index" integer,
  ADD COLUMN "is_required" boolean,
  ADD COLUMN "sla_days" integer,
  ADD COLUMN "auto_transition" boolean,
  ADD COLUMN "require_approval" boolean,
  ADD COLUMN "next_stage_id" uuid,
  ADD COLUMN "conditions" jsonb,
  ADD COLUMN "entry_actions" jsonb,
  ADD COLUMN "exit_actions" jsonb,
  ADD COLUMN "notify_on_entry" boolean,
  ADD COLUMN "notify_on_deadline" boolean,
  ADD COLUMN "notification_template_id" uuid,
  ADD COLUMN "metadata" jsonb;

-- grievance_transitions: +7 columns
ALTER TABLE "grievance_transitions"
  ADD COLUMN "transitioned_at" timestamp with time zone,
  ADD COLUMN "requires_approval" boolean,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp with time zone,
  ADD COLUMN "stage_duration_days" integer,
  ADD COLUMN "visibility_scope" visibility_scope NOT NULL,
  ADD COLUMN "metadata" jsonb;

-- grievance_workflows: +11 columns
ALTER TABLE "grievance_workflows"
  ADD COLUMN "description" text,
  ADD COLUMN "grievance_type" varchar(100),
  ADD COLUMN "contract_id" uuid,
  ADD COLUMN "is_default" boolean,
  ADD COLUMN "status" grievance_workflow_status,
  ADD COLUMN "auto_assign" boolean,
  ADD COLUMN "require_approval" boolean,
  ADD COLUMN "sla_days" integer,
  ADD COLUMN "stages" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "created_by" varchar(255);

-- bargaining_team_members: +2 columns
ALTER TABLE "bargaining_team_members"
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- dues_transactions: +22 columns
ALTER TABLE "dues_transactions"
  ADD COLUMN "amount" numeric(10, 2),
  ADD COLUMN "period_start" date,
  ADD COLUMN "period_end" date,
  ADD COLUMN "due_date" date,
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "payment_date" timestamp with time zone,
  ADD COLUMN "payment_method" varchar(50),
  ADD COLUMN "payment_reference" varchar(255),
  ADD COLUMN "processor_type" payment_processor,
  ADD COLUMN "processor_payment_id" varchar(255),
  ADD COLUMN "processor_customer_id" varchar(255),
  ADD COLUMN "notes" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "dues_amount" numeric(10, 2),
  ADD COLUMN "cope_amount" numeric(10, 2),
  ADD COLUMN "pac_amount" numeric(10, 2),
  ADD COLUMN "strike_fund_amount" numeric(10, 2),
  ADD COLUMN "late_fee_amount" numeric(10, 2),
  ADD COLUMN "adjustment_amount" numeric(10, 2),
  ADD COLUMN "total_amount" numeric(10, 2),
  ADD COLUMN "paid_date" timestamp with time zone,
  ADD COLUMN "receipt_url" text;

-- autopay_settings: +19 columns
ALTER TABLE "autopay_settings"
  ADD COLUMN "enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "stripe_customer_id" varchar(255),
  ADD COLUMN "stripe_payment_method_id" varchar(255),
  ADD COLUMN "payment_method_last4" varchar(4),
  ADD COLUMN "payment_method_brand" varchar(50),
  ADD COLUMN "payment_method_type" varchar(50),
  ADD COLUMN "max_amount" numeric(10, 2),
  ADD COLUMN "frequency" varchar(50),
  ADD COLUMN "day_of_month" varchar(2),
  ADD COLUMN "last_payment_date" timestamp,
  ADD COLUMN "last_payment_amount" numeric(10, 2),
  ADD COLUMN "last_payment_status" varchar(50),
  ADD COLUMN "next_payment_date" timestamp,
  ADD COLUMN "failure_count" varchar(255),
  ADD COLUMN "last_failure_reason" text,
  ADD COLUMN "notify_before_payment" boolean,
  ADD COLUMN "notify_days_before" varchar(255),
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- bank_reconciliation: +13 columns
ALTER TABLE "bank_reconciliation"
  ADD COLUMN "bank_statement_date" timestamp,
  ADD COLUMN "bank_deposit_id" varchar,
  ADD COLUMN "deposit_amount" numeric(19, 2),
  ADD COLUMN "deposit_currency" varchar(3),
  ADD COLUMN "status" reconciliation_status,
  ADD COLUMN "reconciled_amount" numeric(19, 2),
  ADD COLUMN "unmatched_amount" numeric(19, 2),
  ADD COLUMN "matched_payment_ids" uuid[],
  ADD COLUMN "unmatched_payment_ids" uuid[],
  ADD COLUMN "notes" text,
  ADD COLUMN "reconciliation_notes" text,
  ADD COLUMN "reconciled_by" varchar(255),
  ADD COLUMN "reconciled_at" timestamp;

-- payment_cycles: +9 columns
ALTER TABLE "payment_cycles"
  ADD COLUMN "name" varchar(100),
  ADD COLUMN "description" text,
  ADD COLUMN "cycle_type" varchar(50),
  ADD COLUMN "start_date" timestamp,
  ADD COLUMN "end_date" timestamp,
  ADD COLUMN "due_date" timestamp,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "is_closed" boolean,
  ADD COLUMN "closed_at" timestamp;

-- payment_disputes: +9 columns
ALTER TABLE "payment_disputes"
  ADD COLUMN "payment_id" uuid,
  ADD COLUMN "reason" text,
  ADD COLUMN "description" text,
  ADD COLUMN "status" varchar(50),
  ADD COLUMN "resolved_amount" numeric(19, 2),
  ADD COLUMN "resolution_notes" text,
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "filed_by" varchar(255),
  ADD COLUMN "resolved_by" varchar(255);

-- payment_methods: +11 columns
ALTER TABLE "payment_methods"
  ADD COLUMN "member_id" varchar(255),
  ADD COLUMN "type" payment_method,
  ADD COLUMN "is_default" boolean,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "stripe_payment_method_id" varchar,
  ADD COLUMN "stripe_billing_details" jsonb,
  ADD COLUMN "processor_type" payment_processor,
  ADD COLUMN "processor_method_id" varchar(255),
  ADD COLUMN "bank_account_token" varchar,
  ADD COLUMN "bank_account_last_4" varchar(4),
  ADD COLUMN "expires_at" timestamp;

-- payments: +23 columns
ALTER TABLE "payments"
  ADD COLUMN "member_id" varchar(255),
  ADD COLUMN "amount" numeric(19, 2),
  ADD COLUMN "currency" varchar(3),
  ADD COLUMN "type" payment_type,
  ADD COLUMN "status" payment_status NOT NULL,
  ADD COLUMN "method" payment_method,
  ADD COLUMN "stripe_payment_intent_id" varchar,
  ADD COLUMN "stripe_price_id" varchar,
  ADD COLUMN "stripe_invoice_id" varchar,
  ADD COLUMN "bank_deposit_id" varchar,
  ADD COLUMN "check_number" varchar,
  ADD COLUMN "reference_number" varchar,
  ADD COLUMN "processor_type" payment_processor,
  ADD COLUMN "processor_customer_id" varchar(255),
  ADD COLUMN "payment_cycle_id" uuid,
  ADD COLUMN "due_date" timestamp,
  ADD COLUMN "paid_date" timestamp,
  ADD COLUMN "reconciliation_status" reconciliation_status,
  ADD COLUMN "reconciliation_date" timestamp,
  ADD COLUMN "notes" text,
  ADD COLUMN "failure_reason" text,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- stripe_webhook_events: +8 columns
ALTER TABLE "stripe_webhook_events"
  ADD COLUMN "stripe_event_id" varchar,
  ADD COLUMN "event_type" varchar(100),
  ADD COLUMN "stripe_payment_intent_id" varchar,
  ADD COLUMN "stripe_customer_id" varchar,
  ADD COLUMN "event_data" jsonb,
  ADD COLUMN "processed" boolean,
  ADD COLUMN "processed_at" timestamp,
  ADD COLUMN "processing_error" text;

-- cost_centers: +15 columns
ALTER TABLE "cost_centers"
  ADD COLUMN "code" varchar(50),
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "type" cost_center_type,
  ADD COLUMN "parent_cost_center_id" uuid,
  ADD COLUMN "manager" varchar(255),
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "budget_amount" numeric(19, 2),
  ADD COLUMN "budget_period" varchar(50),
  ADD COLUMN "budget_start_date" timestamp,
  ADD COLUMN "budget_end_date" timestamp,
  ADD COLUMN "warning_threshold" integer,
  ADD COLUMN "external_code" varchar(100),
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- gl_transaction_log: +19 columns
ALTER TABLE "gl_transaction_log"
  ADD COLUMN "chart_of_accounts_id" uuid,
  ADD COLUMN "transaction_date" timestamp,
  ADD COLUMN "transaction_number" varchar(50),
  ADD COLUMN "description" text,
  ADD COLUMN "debit_amount" numeric(19, 2),
  ADD COLUMN "credit_amount" numeric(19, 2),
  ADD COLUMN "cost_center_id" uuid,
  ADD COLUMN "invoice_number" varchar(100),
  ADD COLUMN "receipt_number" varchar(100),
  ADD COLUMN "purchase_order_number" varchar(100),
  ADD COLUMN "source_system" varchar(100),
  ADD COLUMN "source_record_id" varchar(100),
  ADD COLUMN "is_posted" boolean,
  ADD COLUMN "posted_at" timestamp,
  ADD COLUMN "posted_by" varchar(255),
  ADD COLUMN "is_reconciled" boolean,
  ADD COLUMN "reconciled_at" timestamp,
  ADD COLUMN "reconciled_by" varchar(255),
  ADD COLUMN "created_by" varchar(255);

-- gl_trial_balance: +12 columns
ALTER TABLE "gl_trial_balance"
  ADD COLUMN "chart_of_accounts_id" uuid,
  ADD COLUMN "period_end_date" timestamp,
  ADD COLUMN "opening_balance" numeric(19, 2),
  ADD COLUMN "debit_total" numeric(19, 2),
  ADD COLUMN "credit_total" numeric(19, 2),
  ADD COLUMN "closing_balance" numeric(19, 2),
  ADD COLUMN "is_finalized" boolean,
  ADD COLUMN "finalized_at" timestamp,
  ADD COLUMN "finalized_by" varchar(255),
  ADD COLUMN "is_balanced" boolean,
  ADD COLUMN "balance" numeric(19, 2),
  ADD COLUMN "created_by" varchar(255);

-- rl1_tax_slips: +26 columns
ALTER TABLE "rl1_tax_slips"
  ADD COLUMN "tax_year" varchar(4),
  ADD COLUMN "payer_name" text,
  ADD COLUMN "payer_quebec_enterprise_number" varchar(10),
  ADD COLUMN "payer_address" text,
  ADD COLUMN "payer_city" varchar(100),
  ADD COLUMN "payer_postal_code" varchar(10),
  ADD COLUMN "recipient_name" text,
  ADD COLUMN "recipient_sin" varchar(11),
  ADD COLUMN "recipient_address" text,
  ADD COLUMN "recipient_city" varchar(100),
  ADD COLUMN "recipient_postal_code" varchar(10),
  ADD COLUMN "box_o_other_income" numeric(10, 2),
  ADD COLUMN "box_e_quebec_income_tax_deducted" numeric(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "generated_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "generated_by" varchar(255),
  ADD COLUMN "filed_with_revenu_quebec" boolean NOT NULL DEFAULT false,
  ADD COLUMN "revenu_quebec_filing_date" timestamp,
  ADD COLUMN "revenu_quebec_confirmation_number" varchar(50),
  ADD COLUMN "delivered_to_member" boolean NOT NULL DEFAULT false,
  ADD COLUMN "delivery_method" varchar(50),
  ADD COLUMN "delivered_at" timestamp,
  ADD COLUMN "pdf_url" text,
  ADD COLUMN "xml_url" text,
  ADD COLUMN "is_amendment" boolean NOT NULL DEFAULT false,
  ADD COLUMN "original_slip_id" uuid,
  ADD COLUMN "amendment_reason" text;

-- strike_fund_disbursements: +20 columns
ALTER TABLE "strike_fund_disbursements"
  ADD COLUMN "strike_id" uuid,
  ADD COLUMN "strike_name" text,
  ADD COLUMN "strike_start_date" timestamp,
  ADD COLUMN "strike_end_date" timestamp,
  ADD COLUMN "payment_date" timestamp,
  ADD COLUMN "payment_amount" numeric(10, 2),
  ADD COLUMN "payment_method" varchar(50),
  ADD COLUMN "payment_reference" varchar(100),
  ADD COLUMN "tax_year" varchar(4),
  ADD COLUMN "tax_month" varchar(2),
  ADD COLUMN "week_number" varchar(10),
  ADD COLUMN "weekly_total" numeric(10, 2),
  ADD COLUMN "exceeds_threshold" boolean NOT NULL DEFAULT false,
  ADD COLUMN "requires_tax_slip" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t4a_generated" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t4a_generated_at" timestamp,
  ADD COLUMN "rl1_generated" boolean NOT NULL DEFAULT false,
  ADD COLUMN "rl1_generated_at" timestamp,
  ADD COLUMN "province" varchar(2),
  ADD COLUMN "is_quebec_resident" boolean NOT NULL DEFAULT false;

-- t4a_tax_slips: +28 columns
ALTER TABLE "t4a_tax_slips"
  ADD COLUMN "tax_year" varchar(4),
  ADD COLUMN "payer_name" text,
  ADD COLUMN "payer_business_number" varchar(15),
  ADD COLUMN "payer_address" text,
  ADD COLUMN "payer_city" varchar(100),
  ADD COLUMN "payer_province" varchar(2),
  ADD COLUMN "payer_postal_code" varchar(10),
  ADD COLUMN "recipient_name" text,
  ADD COLUMN "recipient_sin" varchar(11),
  ADD COLUMN "recipient_address" text,
  ADD COLUMN "recipient_city" varchar(100),
  ADD COLUMN "recipient_province" varchar(2),
  ADD COLUMN "recipient_postal_code" varchar(10),
  ADD COLUMN "box_028_other_income" numeric(10, 2),
  ADD COLUMN "box_022_income_tax_deducted" numeric(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "generated_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "generated_by" varchar(255),
  ADD COLUMN "filed_with_cra" boolean NOT NULL DEFAULT false,
  ADD COLUMN "cra_filing_date" timestamp,
  ADD COLUMN "cra_confirmation_number" varchar(50),
  ADD COLUMN "delivered_to_member" boolean NOT NULL DEFAULT false,
  ADD COLUMN "delivery_method" varchar(50),
  ADD COLUMN "delivered_at" timestamp,
  ADD COLUMN "pdf_url" text,
  ADD COLUMN "xml_url" text,
  ADD COLUMN "is_amendment" boolean NOT NULL DEFAULT false,
  ADD COLUMN "original_slip_id" uuid,
  ADD COLUMN "amendment_reason" text;

-- tax_year_end_processing: +19 columns
ALTER TABLE "tax_year_end_processing"
  ADD COLUMN "processing_started_at" timestamp,
  ADD COLUMN "processing_completed_at" timestamp,
  ADD COLUMN "t4a_slips_generated" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "t4a_total_amount" numeric(12, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "t4a_filing_deadline" timestamp,
  ADD COLUMN "t4a_filed_at" timestamp,
  ADD COLUMN "t4a_filing_confirmed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "rl1_slips_generated" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "rl1_total_amount" numeric(12, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "rl1_filing_deadline" timestamp,
  ADD COLUMN "rl1_filed_at" timestamp,
  ADD COLUMN "rl1_filing_confirmed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "member_delivery_started_at" timestamp,
  ADD COLUMN "member_delivery_completed_at" timestamp,
  ADD COLUMN "slips_delivered_to_members" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "compliance_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "deadline_missed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "processed_by" varchar(255),
  ADD COLUMN "notes" text;

-- weekly_threshold_tracking: +10 columns
ALTER TABLE "weekly_threshold_tracking"
  ADD COLUMN "tax_year" varchar(4),
  ADD COLUMN "week_number" varchar(10),
  ADD COLUMN "week_start_date" timestamp,
  ADD COLUMN "week_end_date" timestamp,
  ADD COLUMN "payment_count" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "weekly_total" numeric(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "exceeds_threshold" boolean NOT NULL DEFAULT false,
  ADD COLUMN "threshold_amount" numeric(10, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "requires_t4a" boolean NOT NULL DEFAULT false,
  ADD COLUMN "requires_rl1" boolean NOT NULL DEFAULT false;

-- bank_of_canada_rates: +7 columns
ALTER TABLE "bank_of_canada_rates"
  ADD COLUMN "noon_rate" numeric(15, 8),
  ADD COLUMN "buy_rate" numeric(15, 8),
  ADD COLUMN "sell_rate" numeric(15, 8),
  ADD COLUMN "source" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "data_quality" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "imported_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "imported_by" varchar(255);

-- cross_border_transactions: +12 columns
ALTER TABLE "cross_border_transactions"
  ADD COLUMN "cad_equivalent_cents" integer,
  ADD COLUMN "from_country_code" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "to_country_code" varchar(2),
  ADD COLUMN "from_party_type" varchar(50),
  ADD COLUMN "to_party_type" varchar(50),
  ADD COLUMN "cra_reporting_status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "requires_t106" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t106_filed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t106_filing_date" timestamp,
  ADD COLUMN "transaction_type" varchar(50),
  ADD COLUMN "counterparty_name" text,
  ADD COLUMN "description" text;

-- currency_enforcement_audit: +9 columns
ALTER TABLE "currency_enforcement_audit"
  ADD COLUMN "action_description" text,
  ADD COLUMN "transaction_id" uuid,
  ADD COLUMN "affected_currency" varchar(3),
  ADD COLUMN "affected_amount" numeric(15, 2),
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "compliance_impact" varchar(20),
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "ip_address" varchar(45);

-- currency_enforcement_policy: +7 columns
ALTER TABLE "currency_enforcement_policy"
  ADD COLUMN "allow_foreign_currency" boolean NOT NULL DEFAULT false,
  ADD COLUMN "foreign_currency_reason" text,
  ADD COLUMN "fx_rate_source" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "fx_rate_update_frequency" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "t106_filing_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t106_threshold_cad" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "updated_by" varchar(255);

-- currency_enforcement_violations: +12 columns
ALTER TABLE "currency_enforcement_violations"
  ADD COLUMN "violation_description" text,
  ADD COLUMN "transaction_id" uuid,
  ADD COLUMN "attempted_currency" varchar(3),
  ADD COLUMN "attempted_amount" numeric(15, 2),
  ADD COLUMN "attempted_by" varchar(255),
  ADD COLUMN "attempted_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "resolution" text,
  ADD COLUMN "resolved_by" varchar(255),
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text;

-- exchange_rates: +7 columns
ALTER TABLE "exchange_rates"
  ADD COLUMN "to_currency" varchar(3) NOT NULL DEFAULT '',
  ADD COLUMN "exchange_rate" varchar(20),
  ADD COLUMN "rate_source" varchar(50),
  ADD COLUMN "effective_date" timestamp,
  ADD COLUMN "rate_timestamp" timestamp,
  ADD COLUMN "provider" varchar(100),
  ADD COLUMN "data_quality" varchar(20);

-- fx_rate_audit_log: +8 columns
ALTER TABLE "fx_rate_audit_log"
  ADD COLUMN "action_description" text,
  ADD COLUMN "currency" varchar(3),
  ADD COLUMN "rate_date" timestamp,
  ADD COLUMN "old_rate" numeric(15, 8),
  ADD COLUMN "new_rate" numeric(15, 8),
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "metadata" jsonb;

-- t106_filing_tracking: +13 columns
ALTER TABLE "t106_filing_tracking"
  ADD COLUMN "total_foreign_transactions" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "total_cad_equivalent" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "t106_threshold_exceeded" boolean NOT NULL DEFAULT false,
  ADD COLUMN "t106_filing_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "reportable_transaction_count" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "reportable_transaction_ids" jsonb,
  ADD COLUMN "filing_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "filing_due_date" timestamp,
  ADD COLUMN "filed_date" timestamp,
  ADD COLUMN "confirmation_number" varchar(50),
  ADD COLUMN "prepared_by" varchar(255),
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "filed_by" varchar(255);

-- transaction_currency_conversions: +11 columns
ALTER TABLE "transaction_currency_conversions"
  ADD COLUMN "original_currency" varchar(3),
  ADD COLUMN "original_amount" numeric(15, 2),
  ADD COLUMN "cad_amount" numeric(15, 2),
  ADD COLUMN "fx_rate_used" numeric(15, 8),
  ADD COLUMN "fx_rate_date" timestamp,
  ADD COLUMN "fx_rate_source" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "exception_approved" boolean NOT NULL DEFAULT false,
  ADD COLUMN "exception_reason" text,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp,
  ADD COLUMN "conversion_method" varchar(50) NOT NULL DEFAULT '';

-- transfer_pricing_documentation: +15 columns
ALTER TABLE "transfer_pricing_documentation"
  ADD COLUMN "from_party" uuid,
  ADD COLUMN "to_party" uuid,
  ADD COLUMN "arms_length_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "arms_length_confirmed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "arms_length_method" varchar(50),
  ADD COLUMN "cad_amount" numeric(15, 2),
  ADD COLUMN "pricing_justification" text,
  ADD COLUMN "comparable_transactions" jsonb,
  ADD COLUMN "supporting_documents" jsonb,
  ADD COLUMN "documented_by" varchar(255),
  ADD COLUMN "documented_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "review_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "reviewed_at" timestamp,
  ADD COLUMN "review_notes" text;

-- organization_billing_config: +5 columns
ALTER TABLE "organization_billing_config"
  ADD COLUMN "billing_frequency" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "billing_day_of_month" integer,
  ADD COLUMN "timezone" varchar(50),
  ADD COLUMN "enabled" boolean,
  ADD COLUMN "metadata" jsonb;

-- arms_length_verification: +16 columns
ALTER TABLE "arms_length_verification"
  ADD COLUMN "transaction_amount" numeric(15, 2),
  ADD COLUMN "from_party" uuid,
  ADD COLUMN "to_party" uuid,
  ADD COLUMN "relationship_exists" boolean NOT NULL DEFAULT false,
  ADD COLUMN "relationship_type" varchar(50),
  ADD COLUMN "relationship_description" text,
  ADD COLUMN "arms_length_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "arms_length_justification" text,
  ADD COLUMN "verification_method" varchar(50),
  ADD COLUMN "comparable_transactions" jsonb,
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "reviewed_at" timestamp,
  ADD COLUMN "review_decision" varchar(20),
  ADD COLUMN "review_notes" text,
  ADD COLUMN "compliant" boolean NOT NULL DEFAULT false,
  ADD COLUMN "compliance_notes" text;

-- blind_trust_registry: +19 columns
ALTER TABLE "blind_trust_registry"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "trust_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "trust_established_date" timestamp,
  ADD COLUMN "trustee_name" text,
  ADD COLUMN "trustee_contact" text,
  ADD COLUMN "trustee_relationship" varchar(50),
  ADD COLUMN "trust_type" varchar(50),
  ADD COLUMN "trust_document" text,
  ADD COLUMN "trust_account_number" varchar(100),
  ADD COLUMN "assets_transferred" jsonb,
  ADD COLUMN "estimated_value" numeric(15, 2),
  ADD COLUMN "verified_by" varchar(255),
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "verification_notes" text,
  ADD COLUMN "last_review_date" timestamp,
  ADD COLUMN "next_review_due" timestamp,
  ADD COLUMN "compliant" boolean NOT NULL DEFAULT false,
  ADD COLUMN "compliance_notes" text;

-- conflict_audit_log: +9 columns
ALTER TABLE "conflict_audit_log"
  ADD COLUMN "action_description" text,
  ADD COLUMN "subject_user_id" varchar(255),
  ADD COLUMN "related_disclosure_id" uuid,
  ADD COLUMN "related_transaction_id" uuid,
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "compliance_impact" varchar(20),
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "ip_address" varchar(45);

-- conflict_disclosures: +20 columns
ALTER TABLE "conflict_disclosures"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "disclosure_type" varchar(50),
  ADD COLUMN "disclosure_year" varchar(4),
  ADD COLUMN "conflict_type" varchar(50),
  ADD COLUMN "conflict_description" text,
  ADD COLUMN "related_parties" jsonb,
  ADD COLUMN "related_transaction_ids" jsonb,
  ADD COLUMN "financial_interest_amount" numeric(15, 2),
  ADD COLUMN "ownership_percentage" numeric(5, 2),
  ADD COLUMN "mitigation_plan" text,
  ADD COLUMN "recusal_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "recusal_documented" boolean NOT NULL DEFAULT false,
  ADD COLUMN "review_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "review_notes" text,
  ADD COLUMN "reviewed_by" jsonb,
  ADD COLUMN "review_completed_at" timestamp,
  ADD COLUMN "disclosure_deadline" timestamp,
  ADD COLUMN "submitted_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "overdue" boolean NOT NULL DEFAULT false;

-- conflict_of_interest_policy: +6 columns
ALTER TABLE "conflict_of_interest_policy"
  ADD COLUMN "significant_interest_threshold" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "arms_length_verification_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "covered_roles" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "review_committee_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "minimum_reviewers" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "updated_by" varchar(255);

-- conflict_review_committee: +8 columns
ALTER TABLE "conflict_review_committee"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "committee_role" varchar(50),
  ADD COLUMN "appointed_by" varchar(255),
  ADD COLUMN "appointed_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "term_start_date" timestamp,
  ADD COLUMN "term_end_date" timestamp,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '';

-- conflict_training: +9 columns
ALTER TABLE "conflict_training"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "training_type" varchar(50),
  ADD COLUMN "training_date" timestamp,
  ADD COLUMN "training_provider" text,
  ADD COLUMN "completion_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "completed_at" timestamp,
  ADD COLUMN "certificate_url" text,
  ADD COLUMN "next_training_due" timestamp;

-- recusal_tracking: +16 columns
ALTER TABLE "recusal_tracking"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "recusal_type" varchar(50),
  ADD COLUMN "recusal_reason" text,
  ADD COLUMN "related_matter" text,
  ADD COLUMN "related_meeting_id" uuid,
  ADD COLUMN "related_vote_id" uuid,
  ADD COLUMN "related_transaction_id" uuid,
  ADD COLUMN "recusal_documented" boolean NOT NULL DEFAULT false,
  ADD COLUMN "documentation_url" text,
  ADD COLUMN "documented_by" varchar(255),
  ADD COLUMN "documented_at" timestamp,
  ADD COLUMN "recusal_start_date" timestamp,
  ADD COLUMN "recusal_end_date" timestamp,
  ADD COLUMN "verified_by" varchar(255),
  ADD COLUMN "verified_at" timestamp;

-- message_notifications: +4 columns
ALTER TABLE "message_notifications"
  ADD COLUMN "thread_id" uuid,
  ADD COLUMN "is_read" boolean,
  ADD COLUMN "read_at" timestamp,
  ADD COLUMN "notified_at" timestamp NOT NULL DEFAULT now();

-- message_participants: +6 columns
ALTER TABLE "message_participants"
  ADD COLUMN "user_id" text,
  ADD COLUMN "role" text,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "last_read_at" timestamp,
  ADD COLUMN "joined_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "left_at" timestamp;

-- message_read_receipts: +2 columns
ALTER TABLE "message_read_receipts"
  ADD COLUMN "user_id" text,
  ADD COLUMN "read_at" timestamp NOT NULL DEFAULT now();

-- messages: +12 columns
ALTER TABLE "messages"
  ADD COLUMN "sender_id" text,
  ADD COLUMN "sender_role" text,
  ADD COLUMN "message_type" message_type NOT NULL,
  ADD COLUMN "content" text,
  ADD COLUMN "file_url" text,
  ADD COLUMN "file_name" text,
  ADD COLUMN "file_size" text,
  ADD COLUMN "status" message_status NOT NULL,
  ADD COLUMN "read_at" timestamp,
  ADD COLUMN "is_edited" boolean,
  ADD COLUMN "edited_at" timestamp,
  ADD COLUMN "metadata" text;

-- in_app_notifications: +9 columns
ALTER TABLE "in_app_notifications"
  ADD COLUMN "title" text,
  ADD COLUMN "message" text,
  ADD COLUMN "type" text NOT NULL DEFAULT '',
  ADD COLUMN "action_label" text,
  ADD COLUMN "action_url" text,
  ADD COLUMN "data" jsonb,
  ADD COLUMN "read" boolean NOT NULL DEFAULT false,
  ADD COLUMN "read_at" timestamp,
  ADD COLUMN "expires_at" timestamp;

-- notification_bounces: +9 columns
ALTER TABLE "notification_bounces"
  ADD COLUMN "email" text,
  ADD COLUMN "bounce_type" notification_bounce_type,
  ADD COLUMN "bounce_sub_type" text,
  ADD COLUMN "first_bounced_at" timestamp,
  ADD COLUMN "last_bounced_at" timestamp,
  ADD COLUMN "bounce_count" text NOT NULL DEFAULT '',
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN "suppress_until" timestamp,
  ADD COLUMN "suppression_reason" text;

-- notification_delivery_log: +9 columns
ALTER TABLE "notification_delivery_log"
  ADD COLUMN "notification_id" uuid,
  ADD COLUMN "event" text,
  ADD COLUMN "event_timestamp" timestamp,
  ADD COLUMN "provider_id" text,
  ADD COLUMN "external_event_id" text,
  ADD COLUMN "details" jsonb,
  ADD COLUMN "status_code" text,
  ADD COLUMN "error_message" text,
  ADD COLUMN "metadata" jsonb;

-- notification_history: +11 columns
ALTER TABLE "notification_history"
  ADD COLUMN "recipient" text,
  ADD COLUMN "channel" notification_channel,
  ADD COLUMN "subject" text,
  ADD COLUMN "template" text,
  ADD COLUMN "status" notification_status,
  ADD COLUMN "error" text,
  ADD COLUMN "sent_at" timestamp,
  ADD COLUMN "delivered_at" timestamp,
  ADD COLUMN "opened_at" timestamp,
  ADD COLUMN "clicked_at" timestamp,
  ADD COLUMN "metadata" jsonb;

-- notification_queue: +10 columns
ALTER TABLE "notification_queue"
  ADD COLUMN "status" notification_queue_status NOT NULL,
  ADD COLUMN "priority" notification_priority NOT NULL,
  ADD COLUMN "payload" jsonb,
  ADD COLUMN "attempt_count" text NOT NULL DEFAULT '',
  ADD COLUMN "max_attempts" text NOT NULL DEFAULT '',
  ADD COLUMN "next_retry_at" timestamp,
  ADD COLUMN "processed_at" timestamp,
  ADD COLUMN "completed_at" timestamp,
  ADD COLUMN "result_notification_id" uuid,
  ADD COLUMN "error_message" text;

-- notification_templates: +17 columns
ALTER TABLE "notification_templates"
  ADD COLUMN "template_key" text,
  ADD COLUMN "name" text,
  ADD COLUMN "description" text,
  ADD COLUMN "type" notification_template_type,
  ADD COLUMN "subject" text,
  ADD COLUMN "title" text,
  ADD COLUMN "body_template" text,
  ADD COLUMN "html_body_template" text,
  ADD COLUMN "variables" jsonb,
  ADD COLUMN "default_variables" jsonb,
  ADD COLUMN "channels" notification_channel[],
  ADD COLUMN "status" notification_template_status NOT NULL,
  ADD COLUMN "is_system" boolean NOT NULL DEFAULT false,
  ADD COLUMN "max_retries" text,
  ADD COLUMN "retry_delay_seconds" text,
  ADD COLUMN "created_by" text,
  ADD COLUMN "updated_by" text;

-- notifications: +10 columns
ALTER TABLE "notifications"
  ADD COLUMN "user_id" text,
  ADD COLUMN "type" text,
  ADD COLUMN "title" text,
  ADD COLUMN "message" text,
  ADD COLUMN "priority" text,
  ADD COLUMN "related_entity_type" text,
  ADD COLUMN "related_entity_id" text,
  ADD COLUMN "scheduled_for" timestamp,
  ADD COLUMN "status" notification_schedule_status NOT NULL,
  ADD COLUMN "sent_at" timestamp;

-- user_notification_preferences: +14 columns
ALTER TABLE "user_notification_preferences"
  ADD COLUMN "email" text,
  ADD COLUMN "phone" text,
  ADD COLUMN "email_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "sms_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "push_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "in_app_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "digest_frequency" digest_frequency NOT NULL,
  ADD COLUMN "quiet_hours_start" text,
  ADD COLUMN "quiet_hours_end" text,
  ADD COLUMN "claim_updates" boolean NOT NULL DEFAULT false,
  ADD COLUMN "document_updates" boolean NOT NULL DEFAULT false,
  ADD COLUMN "deadline_alerts" boolean NOT NULL DEFAULT false,
  ADD COLUMN "system_announcements" boolean NOT NULL DEFAULT false,
  ADD COLUMN "security_alerts" boolean NOT NULL DEFAULT false;

-- newsletter_campaigns: +25 columns
ALTER TABLE "newsletter_campaigns"
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "preview_text" varchar(500),
  ADD COLUMN "from_name" varchar(255),
  ADD COLUMN "from_email" varchar(255),
  ADD COLUMN "reply_to_email" varchar(255),
  ADD COLUMN "html_content" text,
  ADD COLUMN "json_structure" jsonb,
  ADD COLUMN "status" varchar(50),
  ADD COLUMN "scheduled_at" timestamp with time zone,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "timezone" varchar(100),
  ADD COLUMN "distribution_list_ids" uuid[],
  ADD COLUMN "recipient_count" integer,
  ADD COLUMN "total_sent" integer,
  ADD COLUMN "total_delivered" integer,
  ADD COLUMN "total_bounced" integer,
  ADD COLUMN "total_opened" integer,
  ADD COLUMN "total_clicked" integer,
  ADD COLUMN "total_unsubscribed" integer,
  ADD COLUMN "total_spam_reports" integer,
  ADD COLUMN "tags" varchar(100)[],
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "created_by" text;

-- newsletter_distribution_lists: +7 columns
ALTER TABLE "newsletter_distribution_lists"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "list_type" varchar(50),
  ADD COLUMN "filter_criteria" jsonb,
  ADD COLUMN "subscriber_count" integer,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "created_by" text;

-- newsletter_engagement: +7 columns
ALTER TABLE "newsletter_engagement"
  ADD COLUMN "recipient_id" uuid,
  ADD COLUMN "profile_id" text,
  ADD COLUMN "event_type" varchar(50),
  ADD COLUMN "event_data" jsonb,
  ADD COLUMN "ip_address" inet,
  ADD COLUMN "user_agent" text,
  ADD COLUMN "occurred_at" timestamp with time zone;

-- newsletter_list_subscribers: +6 columns
ALTER TABLE "newsletter_list_subscribers"
  ADD COLUMN "profile_id" text,
  ADD COLUMN "email" varchar(255),
  ADD COLUMN "status" varchar(50),
  ADD COLUMN "subscribed_at" timestamp with time zone,
  ADD COLUMN "unsubscribed_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb;

-- newsletter_recipients: +10 columns
ALTER TABLE "newsletter_recipients"
  ADD COLUMN "profile_id" text,
  ADD COLUMN "email" varchar(255),
  ADD COLUMN "status" varchar(50),
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone,
  ADD COLUMN "bounced_at" timestamp with time zone,
  ADD COLUMN "bounce_type" varchar(50),
  ADD COLUMN "bounce_reason" text,
  ADD COLUMN "error_message" text,
  ADD COLUMN "metadata" jsonb;

-- newsletter_templates: +11 columns
ALTER TABLE "newsletter_templates"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "category" varchar(100),
  ADD COLUMN "thumbnail_url" text,
  ADD COLUMN "html_content" text,
  ADD COLUMN "json_structure" jsonb,
  ADD COLUMN "variables" jsonb,
  ADD COLUMN "is_system" boolean,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "usage_count" integer,
  ADD COLUMN "created_by" text;

-- sms_campaign_recipients: +7 columns
ALTER TABLE "sms_campaign_recipients"
  ADD COLUMN "user_id" text,
  ADD COLUMN "phone_number" text,
  ADD COLUMN "message_id" uuid,
  ADD COLUMN "status" text NOT NULL DEFAULT '',
  ADD COLUMN "error_message" text,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone;

-- sms_campaigns: +16 columns
ALTER TABLE "sms_campaigns"
  ADD COLUMN "name" text,
  ADD COLUMN "description" text,
  ADD COLUMN "message" text,
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "recipient_filter" jsonb,
  ADD COLUMN "recipient_count" integer,
  ADD COLUMN "sent_count" integer,
  ADD COLUMN "delivered_count" integer,
  ADD COLUMN "failed_count" integer,
  ADD COLUMN "total_cost" numeric(10, 2),
  ADD COLUMN "status" text NOT NULL DEFAULT '',
  ADD COLUMN "scheduled_for" timestamp with time zone,
  ADD COLUMN "started_at" timestamp with time zone,
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "cancelled_at" timestamp with time zone,
  ADD COLUMN "created_by" text;

-- sms_conversations: +8 columns
ALTER TABLE "sms_conversations"
  ADD COLUMN "user_id" text,
  ADD COLUMN "phone_number" text,
  ADD COLUMN "direction" text,
  ADD COLUMN "message" text,
  ADD COLUMN "twilio_sid" text,
  ADD COLUMN "status" text,
  ADD COLUMN "replied_at" timestamp with time zone,
  ADD COLUMN "read_at" timestamp with time zone;

-- sms_messages: +16 columns
ALTER TABLE "sms_messages"
  ADD COLUMN "user_id" text,
  ADD COLUMN "phone_number" text,
  ADD COLUMN "message" text,
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "campaign_id" uuid,
  ADD COLUMN "status" text NOT NULL DEFAULT '',
  ADD COLUMN "twilio_sid" text,
  ADD COLUMN "error_code" text,
  ADD COLUMN "error_message" text,
  ADD COLUMN "segments" integer,
  ADD COLUMN "price_amount" numeric(10, 4),
  ADD COLUMN "price_currency" text,
  ADD COLUMN "direction" text,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone,
  ADD COLUMN "failed_at" timestamp with time zone;

-- sms_opt_outs: +5 columns
ALTER TABLE "sms_opt_outs"
  ADD COLUMN "user_id" text,
  ADD COLUMN "phone_number" text,
  ADD COLUMN "opted_out_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "opted_out_via" text,
  ADD COLUMN "reason" text;

-- sms_rate_limits: +3 columns
ALTER TABLE "sms_rate_limits"
  ADD COLUMN "messages_sent" integer,
  ADD COLUMN "window_start" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "window_end" timestamp with time zone NOT NULL DEFAULT now();

-- sms_templates: +7 columns
ALTER TABLE "sms_templates"
  ADD COLUMN "name" text,
  ADD COLUMN "description" text,
  ADD COLUMN "message_template" text,
  ADD COLUMN "variables" text[],
  ADD COLUMN "category" text,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "created_by" text;

-- push_deliveries: +11 columns
ALTER TABLE "push_deliveries"
  ADD COLUMN "device_id" uuid,
  ADD COLUMN "status" push_delivery_status NOT NULL,
  ADD COLUMN "fcm_message_id" text,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone,
  ADD COLUMN "clicked_at" timestamp with time zone,
  ADD COLUMN "dismissed_at" timestamp with time zone,
  ADD COLUMN "error_code" text,
  ADD COLUMN "error_message" text,
  ADD COLUMN "retry_count" integer,
  ADD COLUMN "event_data" jsonb;

-- push_devices: +12 columns
ALTER TABLE "push_devices"
  ADD COLUMN "profile_id" uuid,
  ADD COLUMN "device_token" text,
  ADD COLUMN "platform" push_platform,
  ADD COLUMN "device_name" text,
  ADD COLUMN "device_model" text,
  ADD COLUMN "os_version" text,
  ADD COLUMN "app_version" text,
  ADD COLUMN "enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "quiet_hours_start" time,
  ADD COLUMN "quiet_hours_end" time,
  ADD COLUMN "timezone" text,
  ADD COLUMN "last_active_at" timestamp with time zone;

-- push_notification_templates: +16 columns
ALTER TABLE "push_notification_templates"
  ADD COLUMN "name" text,
  ADD COLUMN "description" text,
  ADD COLUMN "category" text,
  ADD COLUMN "title" text,
  ADD COLUMN "body" text,
  ADD COLUMN "icon_url" text,
  ADD COLUMN "image_url" text,
  ADD COLUMN "badge_count" integer,
  ADD COLUMN "sound" text,
  ADD COLUMN "click_action" text,
  ADD COLUMN "action_buttons" jsonb,
  ADD COLUMN "variables" jsonb,
  ADD COLUMN "priority" push_priority,
  ADD COLUMN "ttl" integer,
  ADD COLUMN "is_system" boolean NOT NULL DEFAULT false,
  ADD COLUMN "created_by" text;

-- push_notifications: +27 columns
ALTER TABLE "push_notifications"
  ADD COLUMN "name" text,
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "title" text,
  ADD COLUMN "body" text,
  ADD COLUMN "icon_url" text,
  ADD COLUMN "image_url" text,
  ADD COLUMN "badge_count" integer,
  ADD COLUMN "sound" text,
  ADD COLUMN "click_action" text,
  ADD COLUMN "action_buttons" jsonb,
  ADD COLUMN "target_type" text,
  ADD COLUMN "target_criteria" jsonb,
  ADD COLUMN "device_ids" uuid[],
  ADD COLUMN "topics" text[],
  ADD COLUMN "status" push_notification_status NOT NULL,
  ADD COLUMN "priority" push_priority,
  ADD COLUMN "scheduled_at" timestamp with time zone,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "timezone" text,
  ADD COLUMN "ttl" integer,
  ADD COLUMN "total_targeted" integer,
  ADD COLUMN "total_sent" integer,
  ADD COLUMN "total_delivered" integer,
  ADD COLUMN "total_failed" integer,
  ADD COLUMN "total_clicked" integer,
  ADD COLUMN "total_dismissed" integer,
  ADD COLUMN "created_by" text;

-- campaigns: +23 columns
ALTER TABLE "campaigns"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "type" campaign_type,
  ADD COLUMN "channel" campaign_channel,
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "segment_id" uuid,
  ADD COLUMN "segment_query" jsonb,
  ADD COLUMN "audience_count" integer,
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "body" text,
  ADD COLUMN "variables" jsonb,
  ADD COLUMN "scheduled_at" timestamp with time zone,
  ADD COLUMN "send_immediately" boolean,
  ADD COLUMN "timezone" varchar(50),
  ADD COLUMN "status" campaign_status NOT NULL,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "stats" jsonb,
  ADD COLUMN "settings" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" text[],
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- communication_channels: +12 columns
ALTER TABLE "communication_channels"
  ADD COLUMN "type" campaign_channel,
  ADD COLUMN "provider" varchar(50),
  ADD COLUMN "config" jsonb,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "is_primary" boolean,
  ADD COLUMN "daily_limit" integer,
  ADD COLUMN "monthly_limit" integer,
  ADD COLUMN "current_daily_count" integer,
  ADD COLUMN "current_monthly_count" integer,
  ADD COLUMN "last_health_check" timestamp with time zone,
  ADD COLUMN "health_status" varchar(50),
  ADD COLUMN "metadata" jsonb;

-- communication_preferences: +13 columns
ALTER TABLE "communication_preferences"
  ADD COLUMN "user_id" varchar(255),
  ADD COLUMN "email_enabled" boolean,
  ADD COLUMN "sms_enabled" boolean,
  ADD COLUMN "push_enabled" boolean,
  ADD COLUMN "phone_enabled" boolean,
  ADD COLUMN "mail_enabled" boolean,
  ADD COLUMN "categories" jsonb,
  ADD COLUMN "frequency" varchar(50),
  ADD COLUMN "quiet_hours" jsonb,
  ADD COLUMN "globally_unsubscribed" boolean,
  ADD COLUMN "unsubscribed_at" timestamp with time zone,
  ADD COLUMN "unsubscribe_reason" text,
  ADD COLUMN "metadata" jsonb;

-- message_log: +20 columns
ALTER TABLE "message_log"
  ADD COLUMN "campaign_id" uuid,
  ADD COLUMN "recipient_id" varchar(255),
  ADD COLUMN "recipient_email" varchar(255),
  ADD COLUMN "recipient_phone" varchar(50),
  ADD COLUMN "recipient_name" varchar(255),
  ADD COLUMN "channel_type" campaign_channel,
  ADD COLUMN "provider" varchar(50),
  ADD COLUMN "provider_message_id" varchar(255),
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "body_snippet" text,
  ADD COLUMN "status" message_delivery_status NOT NULL,
  ADD COLUMN "error_message" text,
  ADD COLUMN "error_code" varchar(50),
  ADD COLUMN "retry_count" integer,
  ADD COLUMN "sent_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone,
  ADD COLUMN "opened_at" timestamp with time zone,
  ADD COLUMN "clicked_at" timestamp with time zone,
  ADD COLUMN "bounced_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb;

-- message_templates: +16 columns
ALTER TABLE "message_templates"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "description" text,
  ADD COLUMN "type" campaign_channel,
  ADD COLUMN "category" varchar(100),
  ADD COLUMN "subject" varchar(500),
  ADD COLUMN "body" text,
  ADD COLUMN "preheader" text,
  ADD COLUMN "variables" jsonb,
  ADD COLUMN "html_content" text,
  ADD COLUMN "plain_text_content" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "tags" text[],
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "is_default" boolean,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- documents: +14 columns
ALTER TABLE "documents"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "folder_id" uuid,
  ADD COLUMN "name" text,
  ADD COLUMN "file_url" text,
  ADD COLUMN "file_size" integer,
  ADD COLUMN "file_type" text,
  ADD COLUMN "mime_type" text,
  ADD COLUMN "description" text,
  ADD COLUMN "tags" text[],
  ADD COLUMN "content_text" text,
  ADD COLUMN "is_confidential" boolean,
  ADD COLUMN "access_level" text,
  ADD COLUMN "deleted_at" timestamp,
  ADD COLUMN "metadata" jsonb;

-- training_courses: +26 columns
ALTER TABLE "training_courses"
  ADD COLUMN "course_difficulty" varchar(20),
  ADD COLUMN "duration_days" integer,
  ADD COLUMN "has_prerequisites" boolean,
  ADD COLUMN "prerequisite_courses" jsonb,
  ADD COLUMN "prerequisite_certifications" jsonb,
  ADD COLUMN "learning_objectives" text,
  ADD COLUMN "course_outline" jsonb,
  ADD COLUMN "course_materials_url" text,
  ADD COLUMN "presentation_slides_url" text,
  ADD COLUMN "workbook_url" text,
  ADD COLUMN "additional_resources" jsonb,
  ADD COLUMN "primary_instructor_name" varchar(200),
  ADD COLUMN "instructor_ids" jsonb,
  ADD COLUMN "min_enrollment" integer,
  ADD COLUMN "max_enrollment" integer,
  ADD COLUMN "provides_certification" boolean,
  ADD COLUMN "certification_name" varchar(200),
  ADD COLUMN "certification_valid_years" integer,
  ADD COLUMN "clc_approved" boolean,
  ADD COLUMN "clc_approval_date" date,
  ADD COLUMN "clc_course_code" varchar(50),
  ADD COLUMN "course_fee" numeric(10, 2),
  ADD COLUMN "materials_fee" numeric(10, 2),
  ADD COLUMN "travel_subsidy_available" boolean,
  ADD COLUMN "mandatory_for_roles" jsonb,
  ADD COLUMN "notes" text;

-- data_subject_access_requests: +16 columns
ALTER TABLE "data_subject_access_requests"
  ADD COLUMN "request_type" varchar(50),
  ADD COLUMN "province" varchar(2),
  ADD COLUMN "request_description" text,
  ADD COLUMN "requested_data_types" jsonb,
  ADD COLUMN "identity_verified" boolean NOT NULL DEFAULT false,
  ADD COLUMN "verification_method" varchar(50),
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "assigned_to" varchar(255),
  ADD COLUMN "response_deadline" timestamp,
  ADD COLUMN "responded_at" timestamp,
  ADD COLUMN "deadline_met" boolean NOT NULL DEFAULT false,
  ADD COLUMN "denial_reason" text,
  ADD COLUMN "denial_legal_basis" text,
  ADD COLUMN "response_method" varchar(50),
  ADD COLUMN "response_delivered_at" timestamp;

-- privacy_breaches: +17 columns
ALTER TABLE "privacy_breaches"
  ADD COLUMN "severity" varchar(20),
  ADD COLUMN "affected_province" varchar(2),
  ADD COLUMN "affected_user_count" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "data_types" jsonb,
  ADD COLUMN "breach_description" text,
  ADD COLUMN "discovered_at" timestamp,
  ADD COLUMN "contained_at" timestamp,
  ADD COLUMN "user_notification_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "regulator_notification_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "users_notified_at" timestamp,
  ADD COLUMN "regulator_notified_at" timestamp,
  ADD COLUMN "notification_deadline" timestamp,
  ADD COLUMN "deadline_met" boolean NOT NULL DEFAULT false,
  ADD COLUMN "mitigation_steps" jsonb,
  ADD COLUMN "mitigation_completed_at" timestamp,
  ADD COLUMN "incident_report" text,
  ADD COLUMN "reported_by" varchar(255);

-- provincial_consent: +10 columns
ALTER TABLE "provincial_consent"
  ADD COLUMN "province" varchar(2),
  ADD COLUMN "consent_type" varchar(50),
  ADD COLUMN "consent_given" boolean,
  ADD COLUMN "consent_method" varchar(50),
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text,
  ADD COLUMN "consent_text" text,
  ADD COLUMN "consent_language" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "expires_at" timestamp,
  ADD COLUMN "revoked_at" timestamp;

-- provincial_data_handling: +9 columns
ALTER TABLE "provincial_data_handling"
  ADD COLUMN "province" varchar(2),
  ADD COLUMN "action_type" varchar(50),
  ADD COLUMN "data_category" varchar(50),
  ADD COLUMN "purpose" text,
  ADD COLUMN "legal_basis" varchar(50),
  ADD COLUMN "shared_with" text,
  ADD COLUMN "sharing_agreement_id" uuid,
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "ip_address" varchar(45);

-- provincial_privacy_config: +10 columns
ALTER TABLE "provincial_privacy_config"
  ADD COLUMN "law_name" text,
  ADD COLUMN "consent_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "explicit_opt_in" boolean NOT NULL DEFAULT false,
  ADD COLUMN "data_retention_days" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "breach_notification_hours" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "right_to_erasure" boolean NOT NULL DEFAULT false,
  ADD COLUMN "right_to_portability" boolean NOT NULL DEFAULT false,
  ADD COLUMN "dpo_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "pia_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "custom_rules" jsonb;

-- cookie_consents: +10 columns
ALTER TABLE "cookie_consents"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "essential" boolean NOT NULL DEFAULT false,
  ADD COLUMN "functional" boolean NOT NULL DEFAULT false,
  ADD COLUMN "analytics" boolean NOT NULL DEFAULT false,
  ADD COLUMN "marketing" boolean NOT NULL DEFAULT false,
  ADD COLUMN "consent_id" text,
  ADD COLUMN "ip_address" text,
  ADD COLUMN "user_agent" text,
  ADD COLUMN "last_updated" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "expires_at" timestamp;

-- data_anonymization_log: +10 columns
ALTER TABLE "data_anonymization_log"
  ADD COLUMN "operation_type" text,
  ADD COLUMN "reason" text,
  ADD COLUMN "request_id" uuid,
  ADD COLUMN "tables_affected" jsonb,
  ADD COLUMN "executed_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "executed_by" text,
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "verified_by" text,
  ADD COLUMN "can_reverse" boolean NOT NULL DEFAULT false,
  ADD COLUMN "backup_location" text;

-- data_processing_records: +12 columns
ALTER TABLE "data_processing_records"
  ADD COLUMN "activity_name" text,
  ADD COLUMN "processing_purpose" processing_purpose,
  ADD COLUMN "legal_basis" text,
  ADD COLUMN "data_categories" jsonb,
  ADD COLUMN "data_subjects" jsonb,
  ADD COLUMN "recipients" jsonb,
  ADD COLUMN "retention_period" text,
  ADD COLUMN "deletion_procedure" text,
  ADD COLUMN "security_measures" jsonb,
  ADD COLUMN "dpo_contact" text,
  ADD COLUMN "last_reviewed" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "next_review_due" timestamp;

-- data_retention_policies: +10 columns
ALTER TABLE "data_retention_policies"
  ADD COLUMN "policy_name" text,
  ADD COLUMN "data_type" text,
  ADD COLUMN "retention_period_days" text,
  ADD COLUMN "conditions" jsonb,
  ADD COLUMN "action_on_expiry" text,
  ADD COLUMN "archive_location" text,
  ADD COLUMN "legal_requirement" text,
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN "last_executed" timestamp,
  ADD COLUMN "next_execution" timestamp;

-- gdpr_data_requests: +15 columns
ALTER TABLE "gdpr_data_requests"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "request_type" gdpr_request_type,
  ADD COLUMN "status" gdpr_request_status NOT NULL,
  ADD COLUMN "request_details" jsonb,
  ADD COLUMN "requested_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "processed_at" timestamp,
  ADD COLUMN "completed_at" timestamp,
  ADD COLUMN "verification_method" text,
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "verified_by" text,
  ADD COLUMN "response_data" jsonb,
  ADD COLUMN "deadline" timestamp,
  ADD COLUMN "rejection_reason" text,
  ADD COLUMN "processed_by" text,
  ADD COLUMN "notes" text;

-- user_consents: +13 columns
ALTER TABLE "user_consents"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "consent_type" consent_type,
  ADD COLUMN "status" consent_status NOT NULL,
  ADD COLUMN "legal_basis" text,
  ADD COLUMN "processing_purpose" processing_purpose,
  ADD COLUMN "consent_version" text,
  ADD COLUMN "consent_text" text,
  ADD COLUMN "ip_address" text,
  ADD COLUMN "user_agent" text,
  ADD COLUMN "granted_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "expires_at" timestamp,
  ADD COLUMN "withdrawn_at" timestamp,
  ADD COLUMN "metadata" jsonb;

-- geofence_events: +7 columns
ALTER TABLE "geofence_events"
  ADD COLUMN "geofence_id" uuid,
  ADD COLUMN "event_type" varchar(20),
  ADD COLUMN "event_time" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "latitude" numeric(10, 8),
  ADD COLUMN "longitude" numeric(11, 8),
  ADD COLUMN "expires_at" timestamp,
  ADD COLUMN "purpose" text;

-- geofences: +11 columns
ALTER TABLE "geofences"
  ADD COLUMN "center_latitude" numeric(10, 8),
  ADD COLUMN "center_longitude" numeric(11, 8),
  ADD COLUMN "radius_meters" numeric(10, 2),
  ADD COLUMN "strike_id" uuid,
  ADD COLUMN "union_local_id" uuid,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "active_from" timestamp,
  ADD COLUMN "active_to" timestamp,
  ADD COLUMN "notify_on_entry" boolean NOT NULL DEFAULT false,
  ADD COLUMN "notify_on_exit" boolean NOT NULL DEFAULT false,
  ADD COLUMN "requires_explicit_consent" boolean NOT NULL DEFAULT false;

-- location_deletion_log: +7 columns
ALTER TABLE "location_deletion_log"
  ADD COLUMN "deletion_reason" text,
  ADD COLUMN "record_count" varchar(20),
  ADD COLUMN "oldest_record_date" timestamp,
  ADD COLUMN "newest_record_date" timestamp,
  ADD COLUMN "initiated_by" varchar(255),
  ADD COLUMN "initiator_role" varchar(50),
  ADD COLUMN "deleted_at" timestamp NOT NULL DEFAULT now();

-- location_tracking: +16 columns
ALTER TABLE "location_tracking"
  ADD COLUMN "latitude" numeric(10, 8),
  ADD COLUMN "longitude" numeric(11, 8),
  ADD COLUMN "accuracy" numeric(10, 2),
  ADD COLUMN "altitude" numeric(10, 2),
  ADD COLUMN "recorded_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "expires_at" timestamp,
  ADD COLUMN "auto_delete_scheduled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "tracking_type" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "purpose" text,
  ADD COLUMN "activity_type" varchar(50),
  ADD COLUMN "strike_id" uuid,
  ADD COLUMN "event_id" uuid,
  ADD COLUMN "shared_with_union" boolean NOT NULL DEFAULT false,
  ADD COLUMN "aggregated_only" boolean NOT NULL DEFAULT false,
  ADD COLUMN "device_type" varchar(50),
  ADD COLUMN "app_version" varchar(20);

-- location_tracking_audit: +7 columns
ALTER TABLE "location_tracking_audit"
  ADD COLUMN "action_type" varchar(50),
  ADD COLUMN "action_description" text,
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text,
  ADD COLUMN "metadata" jsonb;

-- location_tracking_config: +10 columns
ALTER TABLE "location_tracking_config"
  ADD COLUMN "background_tracking_allowed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "background_tracking_reason" text,
  ADD COLUMN "explicit_opt_in_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "consent_renewal_months" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "auto_deletion_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "auto_deletion_schedule" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "compliance_review_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "last_compliance_review" timestamp,
  ADD COLUMN "next_compliance_review_due" timestamp,
  ADD COLUMN "updated_by" varchar(255);

-- band_council_consent: +13 columns
ALTER TABLE "band_council_consent"
  ADD COLUMN "consent_given" boolean,
  ADD COLUMN "bcr_number" varchar(50),
  ADD COLUMN "bcr_date" timestamp,
  ADD COLUMN "bcr_document" text,
  ADD COLUMN "purpose_of_collection" text,
  ADD COLUMN "data_categories" jsonb,
  ADD COLUMN "intended_use" text,
  ADD COLUMN "expires_at" timestamp,
  ADD COLUMN "restricted_to_members" boolean NOT NULL DEFAULT false,
  ADD COLUMN "anonymization_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "revoked_at" timestamp,
  ADD COLUMN "revocation_reason" text,
  ADD COLUMN "approved_by" varchar(255);

-- band_councils: +11 columns
ALTER TABLE "band_councils"
  ADD COLUMN "province" varchar(2),
  ADD COLUMN "region" varchar(50),
  ADD COLUMN "chief_name" text,
  ADD COLUMN "admin_contact_name" text,
  ADD COLUMN "admin_contact_email" varchar(255),
  ADD COLUMN "admin_contact_phone" varchar(20),
  ADD COLUMN "on_reserve_storage_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "storage_location" text,
  ADD COLUMN "data_residency_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "third_party_access_allowed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "aggregation_allowed" boolean NOT NULL DEFAULT false;

-- indigenous_data_access_log: +9 columns
ALTER TABLE "indigenous_data_access_log"
  ADD COLUMN "accessed_by" varchar(255),
  ADD COLUMN "band_council_id" uuid,
  ADD COLUMN "access_type" varchar(50),
  ADD COLUMN "access_purpose" text,
  ADD COLUMN "data_categories" jsonb,
  ADD COLUMN "authorized_by" varchar(50),
  ADD COLUMN "authorization_reference" text,
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text;

-- indigenous_data_sharing_agreements: +15 columns
ALTER TABLE "indigenous_data_sharing_agreements"
  ADD COLUMN "agreement_title" text,
  ADD COLUMN "agreement_description" text,
  ADD COLUMN "agreement_document" text,
  ADD COLUMN "signed_date" timestamp,
  ADD COLUMN "data_sharing_scope" jsonb,
  ADD COLUMN "purpose_limitation" text,
  ADD COLUMN "anonymization_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "valid_from" timestamp,
  ADD COLUMN "valid_until" timestamp,
  ADD COLUMN "auto_renewal" boolean NOT NULL DEFAULT false,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "bcr_number" varchar(50),
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "terminated_at" timestamp,
  ADD COLUMN "termination_reason" text;

-- indigenous_member_data: +11 columns
ALTER TABLE "indigenous_member_data"
  ADD COLUMN "indigenous_status" varchar(50),
  ADD COLUMN "band_council_id" uuid,
  ADD COLUMN "treaty_number" varchar(20),
  ADD COLUMN "cultural_data_sensitivity" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "traditional_knowledge_holder" boolean NOT NULL DEFAULT false,
  ADD COLUMN "elder_status" boolean NOT NULL DEFAULT false,
  ADD COLUMN "data_control_preference" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "allow_aggregation" boolean NOT NULL DEFAULT false,
  ADD COLUMN "allow_third_party_access" boolean NOT NULL DEFAULT false,
  ADD COLUMN "on_reserve_data_only" boolean NOT NULL DEFAULT false,
  ADD COLUMN "preferred_storage_location" text;

-- traditional_knowledge_registry: +13 columns
ALTER TABLE "traditional_knowledge_registry"
  ADD COLUMN "knowledge_title" text,
  ADD COLUMN "knowledge_description" text,
  ADD COLUMN "sensitivity_level" varchar(20),
  ADD COLUMN "gender_restricted" boolean NOT NULL DEFAULT false,
  ADD COLUMN "age_restricted" boolean NOT NULL DEFAULT false,
  ADD COLUMN "primary_keeper_user_id" varchar(255),
  ADD COLUMN "secondary_keepers" jsonb,
  ADD COLUMN "public_access" boolean NOT NULL DEFAULT false,
  ADD COLUMN "member_only_access" boolean NOT NULL DEFAULT false,
  ADD COLUMN "elder_approval_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "documentation_url" text,
  ADD COLUMN "video_url" text,
  ADD COLUMN "audio_url" text;

-- gss_applications: +1 columns
ALTER TABLE "gss_applications"
  ADD COLUMN "met_2_week_target" boolean;

-- lmbp_compliance_alerts: +3 columns
ALTER TABLE "lmbp_compliance_alerts"
  ADD COLUMN "email_sent" boolean,
  ADD COLUMN "email_sent_at" timestamp,
  ADD COLUMN "dashboard_notified" boolean;

-- lmbp_compliance_reports: +6 columns
ALTER TABLE "lmbp_compliance_reports"
  ADD COLUMN "compliance_rating" text,
  ADD COLUMN "ircc_feedback" text,
  ADD COLUMN "corrective_actions_required" jsonb,
  ADD COLUMN "report_pdf_url" text,
  ADD COLUMN "supporting_documents_urls" jsonb,
  ADD COLUMN "created_by" varchar(255);

-- break_glass_activations: +18 columns
ALTER TABLE "break_glass_activations"
  ADD COLUMN "signature_1_user_id" varchar(255),
  ADD COLUMN "signature_1_timestamp" timestamp,
  ADD COLUMN "signature_1_ip_address" varchar(45),
  ADD COLUMN "signature_2_user_id" varchar(255),
  ADD COLUMN "signature_2_timestamp" timestamp,
  ADD COLUMN "signature_2_ip_address" varchar(45),
  ADD COLUMN "signature_3_user_id" varchar(255),
  ADD COLUMN "signature_3_timestamp" timestamp,
  ADD COLUMN "signature_3_ip_address" varchar(45),
  ADD COLUMN "recovery_actions_log" jsonb,
  ADD COLUMN "swiss_cold_storage_accessed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "cold_storage_accessed_at" timestamp,
  ADD COLUMN "incident_report_url" text,
  ADD COLUMN "lessons_learned_url" text,
  ADD COLUMN "system_updates_required" jsonb,
  ADD COLUMN "audited_at" timestamp,
  ADD COLUMN "audited_by" varchar(255),
  ADD COLUMN "audit_report" text;

-- break_glass_system: +20 columns
ALTER TABLE "break_glass_system"
  ADD COLUMN "scenario_description" text,
  ADD COLUMN "recovery_plan_document" text,
  ADD COLUMN "estimated_recovery_time" varchar(50),
  ADD COLUMN "shamir_threshold" integer NOT NULL DEFAULT 0,
  ADD COLUMN "shamir_total_shares" integer NOT NULL DEFAULT 0,
  ADD COLUMN "key_holder_id_1" varchar(255),
  ADD COLUMN "key_holder_id_2" varchar(255),
  ADD COLUMN "key_holder_id_3" varchar(255),
  ADD COLUMN "key_holder_id_4" varchar(255),
  ADD COLUMN "key_holder_id_5" varchar(255),
  ADD COLUMN "emergency_contact_1_name" text,
  ADD COLUMN "emergency_contact_1_phone" varchar(20),
  ADD COLUMN "emergency_contact_1_email" varchar(255),
  ADD COLUMN "emergency_contact_2_name" text,
  ADD COLUMN "emergency_contact_2_phone" varchar(20),
  ADD COLUMN "emergency_contact_2_email" varchar(255),
  ADD COLUMN "last_tested_at" timestamp,
  ADD COLUMN "testing_frequency" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "next_test_due" timestamp,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '';

-- disaster_recovery_drills: +22 columns
ALTER TABLE "disaster_recovery_drills"
  ADD COLUMN "scenario_type" varchar(50),
  ADD COLUMN "scheduled_date" timestamp,
  ADD COLUMN "actual_start_time" timestamp,
  ADD COLUMN "actual_end_time" timestamp,
  ADD COLUMN "duration" varchar(50),
  ADD COLUMN "participants" jsonb,
  ADD COLUMN "participant_count" integer,
  ADD COLUMN "objectives" jsonb,
  ADD COLUMN "objectives_met" jsonb,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "overall_score" integer,
  ADD COLUMN "target_recovery_time" varchar(50),
  ADD COLUMN "actual_recovery_time" varchar(50),
  ADD COLUMN "recovery_time_objective_met" boolean NOT NULL DEFAULT false,
  ADD COLUMN "issues_identified" jsonb,
  ADD COLUMN "remediation_actions" jsonb,
  ADD COLUMN "remediation_deadline" timestamp,
  ADD COLUMN "drill_report_url" text,
  ADD COLUMN "video_recording_url" text,
  ADD COLUMN "conducted_by" varchar(255),
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp;

-- emergency_declarations: +10 columns
ALTER TABLE "emergency_declarations"
  ADD COLUMN "severity_level" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "declared_by_user_id" varchar(255),
  ADD COLUMN "declared_at" timestamp,
  ADD COLUMN "notes" text,
  ADD COLUMN "affected_locations" jsonb,
  ADD COLUMN "affected_member_count" integer,
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "notification_sent" boolean NOT NULL DEFAULT false,
  ADD COLUMN "break_glass_activated" boolean NOT NULL DEFAULT false;

-- key_holder_registry: +17 columns
ALTER TABLE "key_holder_registry"
  ADD COLUMN "role" varchar(50),
  ADD COLUMN "key_holder_number" integer,
  ADD COLUMN "shamir_share_encrypted" text,
  ADD COLUMN "shamir_share_fingerprint" varchar(64),
  ADD COLUMN "key_issued_at" timestamp,
  ADD COLUMN "key_expires_at" timestamp,
  ADD COLUMN "key_rotation_due" timestamp,
  ADD COLUMN "break_glass_training_completed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "training_completed_at" timestamp,
  ADD COLUMN "training_expires_at" timestamp,
  ADD COLUMN "emergency_phone" varchar(20),
  ADD COLUMN "emergency_email" varchar(255),
  ADD COLUMN "backup_contact_name" text,
  ADD COLUMN "backup_contact_phone" varchar(20),
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "last_verified_at" timestamp,
  ADD COLUMN "next_verification_due" timestamp;

-- recovery_time_objectives: +8 columns
ALTER TABLE "recovery_time_objectives"
  ADD COLUMN "component_description" text,
  ADD COLUMN "rto_hours" integer,
  ADD COLUMN "rpo_hours" integer,
  ADD COLUMN "depends_on" jsonb,
  ADD COLUMN "criticality_level" varchar(20),
  ADD COLUMN "last_tested_at" timestamp,
  ADD COLUMN "last_test_result" varchar(20),
  ADD COLUMN "actual_recovery_time" integer;

-- swiss_cold_storage: +12 columns
ALTER TABLE "swiss_cold_storage"
  ADD COLUMN "vault_location" text,
  ADD COLUMN "vault_account_number" varchar(100),
  ADD COLUMN "storage_type" varchar(50),
  ADD COLUMN "data_category" varchar(50),
  ADD COLUMN "last_updated" timestamp,
  ADD COLUMN "encryption_algorithm" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "encrypted_by" varchar(255),
  ADD COLUMN "access_requires_multi_sig" boolean NOT NULL DEFAULT false,
  ADD COLUMN "minimum_signatures" integer NOT NULL DEFAULT 0,
  ADD COLUMN "total_key_holders" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_accessed_at" timestamp,
  ADD COLUMN "last_accessed_by" varchar(255);

-- data_classification_policy: +1 columns
ALTER TABLE "data_classification_policy"
  ADD COLUMN "allow_grievance_participation" boolean;

-- certification_alerts: +11 columns
ALTER TABLE "certification_alerts"
  ADD COLUMN "alert_type" varchar(50),
  ADD COLUMN "alert_date" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "days_until_expiry" varchar(10),
  ADD COLUMN "notification_sent" boolean NOT NULL DEFAULT false,
  ADD COLUMN "notification_sent_at" timestamp,
  ADD COLUMN "notification_method" varchar(20),
  ADD COLUMN "resolved" boolean NOT NULL DEFAULT false,
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "resolved_by" varchar(255),
  ADD COLUMN "resolution_notes" text;

-- certification_audit_log: +8 columns
ALTER TABLE "certification_audit_log"
  ADD COLUMN "action_description" text,
  ADD COLUMN "certification_id" uuid,
  ADD COLUMN "user_id" varchar(255),
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "compliance_impact" varchar(20),
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "ip_address" varchar(45);

-- certification_compliance_reports: +13 columns
ALTER TABLE "certification_compliance_reports"
  ADD COLUMN "total_staff" varchar(10),
  ADD COLUMN "total_certifications_required" varchar(10),
  ADD COLUMN "total_certifications_current" varchar(10),
  ADD COLUMN "total_certifications_expired" varchar(10),
  ADD COLUMN "total_certifications_pending_renewal" varchar(10),
  ADD COLUMN "total_ce_hours_required" varchar(10),
  ADD COLUMN "total_ce_hours_completed" varchar(10),
  ADD COLUMN "compliance_rate" varchar(10),
  ADD COLUMN "expired_certifications" jsonb,
  ADD COLUMN "upcoming_renewals" jsonb,
  ADD COLUMN "generated_by" varchar(255),
  ADD COLUMN "report_format" varchar(20),
  ADD COLUMN "report_url" text;

-- certification_types: +9 columns
ALTER TABLE "certification_types"
  ADD COLUMN "issuing_authority" text,
  ADD COLUMN "requires_renewal" boolean NOT NULL DEFAULT false,
  ADD COLUMN "renewal_frequency_months" varchar(10),
  ADD COLUMN "continuing_education_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "ce_hours_required" varchar(10),
  ADD COLUMN "required_for_roles" jsonb,
  ADD COLUMN "mandatory" boolean NOT NULL DEFAULT false,
  ADD COLUMN "description" text,
  ADD COLUMN "application_url" text;

-- continuing_education: +11 columns
ALTER TABLE "continuing_education"
  ADD COLUMN "certification_id" uuid,
  ADD COLUMN "course_title" text,
  ADD COLUMN "course_provider" text,
  ADD COLUMN "course_date" date,
  ADD COLUMN "ce_hours_earned" varchar(10),
  ADD COLUMN "ce_category" varchar(50),
  ADD COLUMN "certificate_of_completion" text,
  ADD COLUMN "verified_by" varchar(255),
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "applicable_period_start" date,
  ADD COLUMN "applicable_period_end" date;

-- license_renewals: +11 columns
ALTER TABLE "license_renewals"
  ADD COLUMN "renewal_due_date" date,
  ADD COLUMN "renewal_submitted_date" date,
  ADD COLUMN "renewal_approved_date" date,
  ADD COLUMN "renewal_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "ce_requirements_met" boolean NOT NULL DEFAULT false,
  ADD COLUMN "fee_paid" boolean NOT NULL DEFAULT false,
  ADD COLUMN "application_complete" boolean NOT NULL DEFAULT false,
  ADD COLUMN "renewal_application" text,
  ADD COLUMN "payment_receipt" text,
  ADD COLUMN "approval_letter" text,
  ADD COLUMN "notes" text;

-- staff_certifications: +16 columns
ALTER TABLE "staff_certifications"
  ADD COLUMN "full_name" text,
  ADD COLUMN "role" varchar(100),
  ADD COLUMN "certification_type_id" uuid,
  ADD COLUMN "certification_number" varchar(100),
  ADD COLUMN "issued_date" date,
  ADD COLUMN "expiry_date" date,
  ADD COLUMN "last_renewal_date" date,
  ADD COLUMN "next_renewal_due" date,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "certificate_document" text,
  ADD COLUMN "verification_document" text,
  ADD COLUMN "verified_by" varchar(255),
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "verification_notes" text,
  ADD COLUMN "compliant" boolean NOT NULL DEFAULT false,
  ADD COLUMN "compliance_notes" text;

-- pci_dss_cardholder_data_flow: +5 columns
ALTER TABLE "pci_dss_cardholder_data_flow"
  ADD COLUMN "system_name" varchar(255),
  ADD COLUMN "data_flow_description" text,
  ADD COLUMN "storage_location" text,
  ADD COLUMN "encryption_method" varchar(100),
  ADD COLUMN "last_reviewed_at" timestamp with time zone;

-- pci_dss_encryption_keys: +6 columns
ALTER TABLE "pci_dss_encryption_keys"
  ADD COLUMN "key_type" varchar(50),
  ADD COLUMN "key_identifier" varchar(255),
  ADD COLUMN "rotated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "expires_at" timestamp with time zone,
  ADD COLUMN "rotation_reason" varchar(100),
  ADD COLUMN "metadata" jsonb;

-- pci_dss_quarterly_scans: +7 columns
ALTER TABLE "pci_dss_quarterly_scans"
  ADD COLUMN "scan_date" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "vendor_name" varchar(255),
  ADD COLUMN "scan_status" pci_scan_status NOT NULL,
  ADD COLUMN "vulnerabilities_found" integer NOT NULL DEFAULT 0,
  ADD COLUMN "critical_issues" integer NOT NULL DEFAULT 0,
  ADD COLUMN "report_url" text,
  ADD COLUMN "notes" text;

-- pci_dss_requirements: +6 columns
ALTER TABLE "pci_dss_requirements"
  ADD COLUMN "requirement_number" varchar(50),
  ADD COLUMN "requirement_description" text,
  ADD COLUMN "compliance_status" pci_requirement_status NOT NULL,
  ADD COLUMN "evidence" text,
  ADD COLUMN "remediation_notes" text,
  ADD COLUMN "last_reviewed_at" timestamp with time zone;

-- pci_dss_saq_assessments: +6 columns
ALTER TABLE "pci_dss_saq_assessments"
  ADD COLUMN "assessment_date" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "sqa_level" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "overall_status" pci_assessment_status NOT NULL,
  ADD COLUMN "attestation_of_compliance" text,
  ADD COLUMN "attestation_date" timestamp with time zone,
  ADD COLUMN "metadata" jsonb;

-- lrb_agreements: +32 columns
ALTER TABLE "lrb_agreements"
  ADD COLUMN "source_id" varchar(100),
  ADD COLUMN "employer_name" varchar(500),
  ADD COLUMN "employer_address" text,
  ADD COLUMN "union_name" varchar(500),
  ADD COLUMN "union_code" varchar(50),
  ADD COLUMN "bargaining_unit" varchar(500),
  ADD COLUMN "bargaining_unit_size" integer,
  ADD COLUMN "agreement_date" varchar(20),
  ADD COLUMN "effective_date" timestamp with time zone,
  ADD COLUMN "expiry_date" timestamp with time zone,
  ADD COLUMN "ratification_date" timestamp with time zone,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "sector" varchar(50),
  ADD COLUMN "industry_code" varchar(20),
  ADD COLUMN "industry_name" varchar(255),
  ADD COLUMN "geographic_scope" varchar(100),
  ADD COLUMN "jurisdiction" varchar(10),
  ADD COLUMN "hourly_wage_range" varchar(100),
  ADD COLUMN "annual_salary_range" varchar(100),
  ADD COLUMN "pdf_url" varchar(1000),
  ADD COLUMN "html_url" varchar(1000),
  ADD COLUMN "json_url" varchar(1000),
  ADD COLUMN "extracted_content" text,
  ADD COLUMN "key_terms" jsonb,
  ADD COLUMN "search_keywords" text,
  ADD COLUMN "noc_codes" text,
  ADD COLUMN "occupation_category" varchar(100),
  ADD COLUMN "embedding_vector" text,
  ADD COLUMN "ai_summary" text,
  ADD COLUMN "sentiment_score" integer,
  ADD COLUMN "last_synced_at" timestamp with time zone,
  ADD COLUMN "sync_id" varchar(100);

-- lrb_employers: +11 columns
ALTER TABLE "lrb_employers"
  ADD COLUMN "employer_name_alt" varchar(500),
  ADD COLUMN "jurisdiction" varchar(10),
  ADD COLUMN "city" varchar(100),
  ADD COLUMN "province" varchar(100),
  ADD COLUMN "industry_code" varchar(20),
  ADD COLUMN "industry_name" varchar(255),
  ADD COLUMN "total_agreements" integer,
  ADD COLUMN "active_agreements" integer,
  ADD COLUMN "last_agreement_date" varchar(20),
  ADD COLUMN "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "last_synced_at" timestamp with time zone;

-- lrb_sync_log: +14 columns
ALTER TABLE "lrb_sync_log"
  ADD COLUMN "sync_id" varchar(100),
  ADD COLUMN "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "pages_processed" integer,
  ADD COLUMN "agreements_found" integer,
  ADD COLUMN "agreements_inserted" integer,
  ADD COLUMN "agreements_updated" integer,
  ADD COLUMN "agreements_failed" integer,
  ADD COLUMN "error_message" text,
  ADD COLUMN "error_details" text,
  ADD COLUMN "sync_type" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "parameters" text,
  ADD COLUMN "initiated_by" varchar(100);

-- lrb_unions: +11 columns
ALTER TABLE "lrb_unions"
  ADD COLUMN "union_code" varchar(50),
  ADD COLUMN "acronym" varchar(20),
  ADD COLUMN "parent_organization" varchar(500),
  ADD COLUMN "affiliation_level" varchar(50),
  ADD COLUMN "primary_jurisdiction" varchar(10),
  ADD COLUMN "total_agreements" integer,
  ADD COLUMN "active_agreements" integer,
  ADD COLUMN "total_members" integer,
  ADD COLUMN "last_agreement_date" varchar(20),
  ADD COLUMN "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "last_synced_at" timestamp with time zone;

-- precedent_citations: +7 columns
ALTER TABLE "precedent_citations"
  ADD COLUMN "citing_claim_id" uuid,
  ADD COLUMN "citing_precedent_id" uuid,
  ADD COLUMN "citing_organization_id" uuid,
  ADD COLUMN "citation_context" text,
  ADD COLUMN "citation_type" varchar(50),
  ADD COLUMN "cited_by" varchar(255),
  ADD COLUMN "cited_at" timestamp with time zone NOT NULL DEFAULT now();

-- precedent_tags: +1 columns
ALTER TABLE "precedent_tags"
  ADD COLUMN "tag_name" varchar(100);

-- automation_rules: +14 columns
ALTER TABLE "automation_rules"
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "priority" integer,
  ADD COLUMN "target_entity" varchar(50),
  ADD COLUMN "target_filter" jsonb,
  ADD COLUMN "conditions" jsonb,
  ADD COLUMN "actions" jsonb,
  ADD COLUMN "max_executions" integer,
  ADD COLUMN "executions_count" integer,
  ADD COLUMN "last_executed_at" timestamp with time zone,
  ADD COLUMN "active_from" timestamp with time zone,
  ADD COLUMN "active_until" timestamp with time zone,
  ADD COLUMN "timezone" varchar(50),
  ADD COLUMN "organization_id" varchar(255),
  ADD COLUMN "created_by" varchar(255);

-- clc_sync_log: +14 columns
ALTER TABLE "clc_sync_log"
  ADD COLUMN "sync_id" varchar(100),
  ADD COLUMN "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "records_processed" integer,
  ADD COLUMN "records_inserted" integer,
  ADD COLUMN "records_updated" integer,
  ADD COLUMN "records_failed" integer,
  ADD COLUMN "access_token_used" varchar(50),
  ADD COLUMN "token_refreshed" boolean,
  ADD COLUMN "error_message" text,
  ADD COLUMN "error_details" text,
  ADD COLUMN "parameters" text,
  ADD COLUMN "initiated_by" varchar(100);

-- clc_webhook_log: +8 columns
ALTER TABLE "clc_webhook_log"
  ADD COLUMN "type" varchar(50),
  ADD COLUMN "affiliate_code" varchar(50),
  ADD COLUMN "payload" json,
  ADD COLUMN "status" varchar(20),
  ADD COLUMN "message" text,
  ADD COLUMN "processing_duration" integer,
  ADD COLUMN "received_at" timestamp with time zone NOT NULL,
  ADD COLUMN "processed_at" timestamp with time zone;

-- reward_wallet_ledger: +7 columns
ALTER TABLE "reward_wallet_ledger"
  ADD COLUMN "transaction_type" varchar(50),
  ADD COLUMN "points_change" integer,
  ADD COLUMN "award_id" uuid,
  ADD COLUMN "reference_type" varchar(50),
  ADD COLUMN "reference_id" varchar(255),
  ADD COLUMN "expires_at" timestamp with time zone,
  ADD COLUMN "description" text;

-- organization_sharing_settings: +2 columns
ALTER TABLE "organization_sharing_settings"
  ADD COLUMN "max_shared_clauses" integer,
  ADD COLUMN "max_shared_precedents" integer;

-- cms_pages: +9 columns
ALTER TABLE "cms_pages"
  ADD COLUMN "template_id" uuid,
  ADD COLUMN "meta_keywords" text[],
  ADD COLUMN "og_image" text,
  ADD COLUMN "parent_page_id" uuid,
  ADD COLUMN "scheduled_for" timestamp with time zone,
  ADD COLUMN "is_homepage" boolean,
  ADD COLUMN "requires_auth" boolean,
  ADD COLUMN "allowed_roles" text[],
  ADD COLUMN "seo_config" jsonb;

-- donation_campaigns: +22 columns
ALTER TABLE "donation_campaigns"
  ADD COLUMN "title" text,
  ADD COLUMN "slug" text,
  ADD COLUMN "description" text,
  ADD COLUMN "campaign_type" text,
  ADD COLUMN "goal_amount" numeric(10, 2),
  ADD COLUMN "current_amount" numeric(10, 2),
  ADD COLUMN "currency" text,
  ADD COLUMN "featured_image" text,
  ADD COLUMN "video_url" text,
  ADD COLUMN "start_date" date,
  ADD COLUMN "end_date" date,
  ADD COLUMN "status" text NOT NULL DEFAULT '',
  ADD COLUMN "allow_recurring" boolean,
  ADD COLUMN "suggested_amounts" integer[],
  ADD COLUMN "custom_fields" jsonb,
  ADD COLUMN "thank_you_message" text,
  ADD COLUMN "email_template_id" uuid,
  ADD COLUMN "page_content" jsonb,
  ADD COLUMN "seo_config" jsonb,
  ADD COLUMN "stripe_product_id" text,
  ADD COLUMN "stripe_price_ids" jsonb,
  ADD COLUMN "created_by" text;

-- donation_receipts: +7 columns
ALTER TABLE "donation_receipts"
  ADD COLUMN "donation_id" uuid,
  ADD COLUMN "receipt_number" text,
  ADD COLUMN "receipt_type" text,
  ADD COLUMN "amount" numeric(10, 2),
  ADD COLUMN "issue_date" date,
  ADD COLUMN "pdf_url" text,
  ADD COLUMN "sent_at" timestamp with time zone;

-- donations: +20 columns
ALTER TABLE "donations"
  ADD COLUMN "campaign_id" uuid,
  ADD COLUMN "donor_name" text,
  ADD COLUMN "donor_email" text,
  ADD COLUMN "donor_phone" text,
  ADD COLUMN "amount" numeric(10, 2),
  ADD COLUMN "currency" text,
  ADD COLUMN "is_recurring" boolean,
  ADD COLUMN "recurring_interval" text,
  ADD COLUMN "is_anonymous" boolean,
  ADD COLUMN "message" text,
  ADD COLUMN "custom_data" jsonb,
  ADD COLUMN "stripe_payment_intent_id" text,
  ADD COLUMN "stripe_customer_id" text,
  ADD COLUMN "stripe_subscription_id" text,
  ADD COLUMN "payment_status" text NOT NULL DEFAULT '',
  ADD COLUMN "payment_method" text,
  ADD COLUMN "receipt_sent" boolean,
  ADD COLUMN "receipt_url" text,
  ADD COLUMN "tax_receipt_number" text,
  ADD COLUMN "tax_receipt_issued_at" timestamp with time zone;

-- bank_accounts: +15 columns
ALTER TABLE "bank_accounts"
  ADD COLUMN "connector_id" uuid,
  ADD COLUMN "external_id" varchar(255),
  ADD COLUMN "bank_name" varchar(255),
  ADD COLUMN "account_number" varchar(255),
  ADD COLUMN "account_type" varchar(50),
  ADD COLUMN "currency" varchar(3) NOT NULL DEFAULT '',
  ADD COLUMN "current_balance" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "available_balance" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "gl_account_id" uuid,
  ADD COLUMN "bank_feed_provider" varchar(50),
  ADD COLUMN "bank_feed_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "encrypted_bank_credentials" text,
  ADD COLUMN "last_sync_date" timestamp with time zone,
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN "metadata" jsonb;

-- bank_reconciliations: +11 columns
ALTER TABLE "bank_reconciliations"
  ADD COLUMN "bank_account_id" uuid,
  ADD COLUMN "statement_date" timestamp with time zone,
  ADD COLUMN "statement_balance" numeric(19, 4),
  ADD COLUMN "gl_balance" numeric(19, 4),
  ADD COLUMN "difference" numeric(19, 4),
  ADD COLUMN "status" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "reconciled_by" varchar(255),
  ADD COLUMN "reconciled_at" timestamp with time zone,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb;

-- bank_transactions: +13 columns
ALTER TABLE "bank_transactions"
  ADD COLUMN "transaction_date" timestamp with time zone,
  ADD COLUMN "posting_date" timestamp with time zone,
  ADD COLUMN "description" text,
  ADD COLUMN "amount" numeric(19, 4),
  ADD COLUMN "type" varchar(10),
  ADD COLUMN "balance" numeric(19, 4),
  ADD COLUMN "reference" varchar(255),
  ADD COLUMN "payee" varchar(255),
  ADD COLUMN "category" varchar(255),
  ADD COLUMN "is_reconciled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "reconciled_at" timestamp with time zone,
  ADD COLUMN "matched_transaction_id" uuid,
  ADD COLUMN "metadata" jsonb;

-- currency_exchange_rates: +6 columns
ALTER TABLE "currency_exchange_rates"
  ADD COLUMN "base_currency" varchar(3),
  ADD COLUMN "target_currency" varchar(3),
  ADD COLUMN "rate" numeric(19, 8),
  ADD COLUMN "effective_date" timestamp with time zone,
  ADD COLUMN "source" varchar(100),
  ADD COLUMN "metadata" jsonb;

-- erp_connectors: +12 columns
ALTER TABLE "erp_connectors"
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "system_type" erp_system,
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT false,
  ADD COLUMN "is_primary" boolean NOT NULL DEFAULT false,
  ADD COLUMN "encrypted_credentials" text,
  ADD COLUMN "config" jsonb,
  ADD COLUMN "last_sync_at" timestamp with time zone,
  ADD COLUMN "last_error_at" timestamp with time zone,
  ADD COLUMN "last_error_message" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "updated_by" varchar(255);

-- erp_invoices: +22 columns
ALTER TABLE "erp_invoices"
  ADD COLUMN "connector_id" uuid,
  ADD COLUMN "external_id" varchar(255),
  ADD COLUMN "invoice_number" varchar(100),
  ADD COLUMN "invoice_date" timestamp with time zone,
  ADD COLUMN "due_date" timestamp with time zone,
  ADD COLUMN "customer_id" varchar(255),
  ADD COLUMN "customer_name" varchar(255),
  ADD COLUMN "customer_email" varchar(255),
  ADD COLUMN "billing_address" jsonb,
  ADD COLUMN "shipping_address" jsonb,
  ADD COLUMN "currency" varchar(3) NOT NULL DEFAULT '',
  ADD COLUMN "subtotal" numeric(19, 4),
  ADD COLUMN "tax_amount" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "total_amount" numeric(19, 4),
  ADD COLUMN "amount_paid" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "amount_due" numeric(19, 4),
  ADD COLUMN "status" varchar(50),
  ADD COLUMN "terms" text,
  ADD COLUMN "memo" text,
  ADD COLUMN "pdf_url" text,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "synced_at" timestamp with time zone;

-- financial_audit_log: +10 columns
ALTER TABLE "financial_audit_log"
  ADD COLUMN "entity_type" varchar(100),
  ADD COLUMN "org_id" uuid,
  ADD COLUMN "action" audit_action,
  ADD COLUMN "user_id" varchar(255),
  ADD COLUMN "user_name" varchar(255),
  ADD COLUMN "changes" jsonb,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text,
  ADD COLUMN "timestamp" timestamp with time zone NOT NULL DEFAULT now();

-- journal_entries: +18 columns
ALTER TABLE "journal_entries"
  ADD COLUMN "connector_id" uuid,
  ADD COLUMN "external_id" varchar(255),
  ADD COLUMN "entry_number" varchar(100),
  ADD COLUMN "entry_date" timestamp with time zone,
  ADD COLUMN "posting_date" timestamp with time zone,
  ADD COLUMN "description" text,
  ADD COLUMN "reference" varchar(255),
  ADD COLUMN "currency" varchar(3) NOT NULL DEFAULT '',
  ADD COLUMN "total_debit" numeric(19, 4),
  ADD COLUMN "total_credit" numeric(19, 4),
  ADD COLUMN "is_posted" boolean NOT NULL DEFAULT false,
  ADD COLUMN "is_reversed" boolean NOT NULL DEFAULT false,
  ADD COLUMN "reversal_entry_id" uuid,
  ADD COLUMN "created_by" varchar(255),
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "synced_at" timestamp with time zone;

-- journal_entry_lines: +11 columns
ALTER TABLE "journal_entry_lines"
  ADD COLUMN "line_number" integer,
  ADD COLUMN "account_id" uuid,
  ADD COLUMN "debit_amount" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "credit_amount" numeric(19, 4) NOT NULL DEFAULT '0',
  ADD COLUMN "description" text,
  ADD COLUMN "member_id" uuid,
  ADD COLUMN "bargaining_unit_id" uuid,
  ADD COLUMN "department_id" varchar(255),
  ADD COLUMN "location_id" varchar(255),
  ADD COLUMN "project_id" varchar(255),
  ADD COLUMN "metadata" jsonb;

-- sync_jobs: +11 columns
ALTER TABLE "sync_jobs"
  ADD COLUMN "connector_id" uuid,
  ADD COLUMN "entity_type" varchar(100),
  ADD COLUMN "direction" sync_direction,
  ADD COLUMN "status" sync_status NOT NULL,
  ADD COLUMN "started_at" timestamp with time zone,
  ADD COLUMN "completed_at" timestamp with time zone,
  ADD COLUMN "records_processed" integer NOT NULL DEFAULT 0,
  ADD COLUMN "records_succeeded" integer NOT NULL DEFAULT 0,
  ADD COLUMN "records_failed" integer NOT NULL DEFAULT 0,
  ADD COLUMN "errors" jsonb,
  ADD COLUMN "metadata" jsonb;

-- clc_bargaining_trends: +16 columns
ALTER TABLE "clc_bargaining_trends"
  ADD COLUMN "sub_sector" varchar(100),
  ADD COLUMN "bargaining_unit_size" varchar(50),
  ADD COLUMN "year" integer,
  ADD COLUMN "quarter" integer,
  ADD COLUMN "total_agreements" integer,
  ADD COLUMN "settled_agreements" integer,
  ADD COLUMN "unsettled_agreements" integer,
  ADD COLUMN "strikes_lockouts" integer,
  ADD COLUMN "average_wage_increase" numeric(5, 2),
  ADD COLUMN "median_wage_increase" numeric(5, 2),
  ADD COLUMN "range_low" numeric(5, 2),
  ADD COLUMN "range_high" numeric(5, 2),
  ADD COLUMN "average_duration_months" integer,
  ADD COLUMN "cola_settlements" numeric(5, 2),
  ADD COLUMN "sync_id" varchar(100),
  ADD COLUMN "source" varchar(50);

-- clc_oauth_tokens: +5 columns
ALTER TABLE "clc_oauth_tokens"
  ADD COLUMN "scopes" text,
  ADD COLUMN "expires_at" timestamp with time zone,
  ADD COLUMN "refresh_expires_at" timestamp with time zone,
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "last_used_at" timestamp with time zone;

-- clc_per_capita_benchmarks: +21 columns
ALTER TABLE "clc_per_capita_benchmarks"
  ADD COLUMN "organization_name" varchar(500),
  ADD COLUMN "organization_type" varchar(100),
  ADD COLUMN "fiscal_year" integer,
  ADD COLUMN "quarter" integer,
  ADD COLUMN "period_start" timestamp with time zone,
  ADD COLUMN "period_end" timestamp with time zone,
  ADD COLUMN "total_members" integer,
  ADD COLUMN "dues_paying_members" integer,
  ADD COLUMN "active_members" integer,
  ADD COLUMN "per_capita_rate" numeric(10, 4),
  ADD COLUMN "total_remittance" numeric(12, 2),
  ADD COLUMN "currency" varchar(3),
  ADD COLUMN "national_average_rate" numeric(10, 4),
  ADD COLUMN "provincial_average_rate" numeric(10, 4),
  ADD COLUMN "percentile_rank" integer,
  ADD COLUMN "size_category_comparison" varchar(50),
  ADD COLUMN "sector_comparison" varchar(50),
  ADD COLUMN "is_verified" boolean,
  ADD COLUMN "verification_date" timestamp with time zone,
  ADD COLUMN "sync_id" varchar(100),
  ADD COLUMN "source" varchar(50);

-- clc_union_density: +17 columns
ALTER TABLE "clc_union_density"
  ADD COLUMN "sub_sector" varchar(100),
  ADD COLUMN "industry_code" varchar(20),
  ADD COLUMN "jurisdiction" varchar(10),
  ADD COLUMN "region_name" varchar(255),
  ADD COLUMN "year" integer,
  ADD COLUMN "month" integer,
  ADD COLUMN "total_workforce" integer,
  ADD COLUMN "union_members" integer,
  ADD COLUMN "union_covered" integer,
  ADD COLUMN "density_percent" numeric(5, 2),
  ADD COLUMN "coverage_percent" numeric(5, 2),
  ADD COLUMN "year_over_year_change" numeric(5, 2),
  ADD COLUMN "month_over_month_change" numeric(5, 2),
  ADD COLUMN "national_density" numeric(5, 2),
  ADD COLUMN "provincial_density" numeric(5, 2),
  ADD COLUMN "sync_id" varchar(100),
  ADD COLUMN "source" varchar(50);

-- clc_api_config: +14 columns
ALTER TABLE "clc_api_config"
  ADD COLUMN "api_url" varchar(500),
  ADD COLUMN "api_key_encrypted" varchar,
  ADD COLUMN "api_secret" varchar,
  ADD COLUMN "is_enabled" boolean,
  ADD COLUMN "sync_frequency" varchar(50),
  ADD COLUMN "last_sync_at" timestamp,
  ADD COLUMN "next_sync_at" timestamp,
  ADD COLUMN "webhook_url_local" varchar(500),
  ADD COLUMN "webhook_secret_encrypted" varchar,
  ADD COLUMN "is_webhook_verified" boolean,
  ADD COLUMN "sync_members_enabled" boolean,
  ADD COLUMN "sync_remittances_enabled" boolean,
  ADD COLUMN "sync_disputes_enabled" boolean,
  ADD COLUMN "configured_by" varchar(255);

-- clc_remittance_mapping: +9 columns
ALTER TABLE "clc_remittance_mapping"
  ADD COLUMN "local_remittance_id" uuid,
  ADD COLUMN "external_remittance_id" varchar(100),
  ADD COLUMN "local_data" jsonb,
  ADD COLUMN "external_data" jsonb,
  ADD COLUMN "reconciliation_status" varchar(50),
  ADD COLUMN "is_verified" boolean,
  ADD COLUMN "verification_notes" text,
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "verified_by" varchar(255);

-- notification_log: +8 columns
ALTER TABLE "notification_log"
  ADD COLUMN "priority" varchar(20),
  ADD COLUMN "channel" varchar(255),
  ADD COLUMN "recipients" text,
  ADD COLUMN "success_count" integer,
  ADD COLUMN "failure_count" integer,
  ADD COLUMN "message_ids" text,
  ADD COLUMN "errors" text,
  ADD COLUMN "sent_at" timestamp with time zone;

-- organization_contacts: +8 columns
ALTER TABLE "organization_contacts"
  ADD COLUMN "role" varchar(100),
  ADD COLUMN "name" varchar(255),
  ADD COLUMN "email" varchar(255),
  ADD COLUMN "phone" varchar(50),
  ADD COLUMN "is_primary" boolean,
  ADD COLUMN "receive_reminders" boolean,
  ADD COLUMN "receive_reports" boolean,
  ADD COLUMN "is_active" boolean;

-- per_capita_remittances: +19 columns
ALTER TABLE "per_capita_remittances"
  ADD COLUMN "total_amount" numeric(12, 2),
  ADD COLUMN "currency" varchar(3),
  ADD COLUMN "clc_account_code" varchar(50),
  ADD COLUMN "gl_account" varchar(50),
  ADD COLUMN "status" varchar(20),
  ADD COLUMN "approval_status" varchar(20),
  ADD COLUMN "submitted_date" timestamp with time zone,
  ADD COLUMN "approved_date" timestamp with time zone,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "rejected_date" timestamp with time zone,
  ADD COLUMN "rejected_by" varchar(255),
  ADD COLUMN "rejection_reason" text,
  ADD COLUMN "paid_date" timestamp with time zone,
  ADD COLUMN "payment_method" varchar(50),
  ADD COLUMN "payment_reference" varchar(100),
  ADD COLUMN "remittance_file_url" text,
  ADD COLUMN "receipt_file_url" text,
  ADD COLUMN "notes" text,
  ADD COLUMN "created_by" varchar(255);

-- remittance_approvals: +9 columns
ALTER TABLE "remittance_approvals"
  ADD COLUMN "approver_role" varchar(50),
  ADD COLUMN "approval_level" varchar(20),
  ADD COLUMN "action" varchar(20),
  ADD COLUMN "status" varchar(20),
  ADD COLUMN "reviewed_at" timestamp with time zone,
  ADD COLUMN "comment" text,
  ADD COLUMN "rejection_reason" text,
  ADD COLUMN "flagged_issues" text,
  ADD COLUMN "requested_changes" text;

-- clc_organization_sync_log: +7 columns
ALTER TABLE "clc_organization_sync_log"
  ADD COLUMN "action" varchar(20),
  ADD COLUMN "changes" text,
  ADD COLUMN "conflicts" json,
  ADD COLUMN "duration" integer,
  ADD COLUMN "error" text,
  ADD COLUMN "synced_at" timestamp with time zone NOT NULL,
  ADD COLUMN "synced_by" varchar(255);

-- cpi_adjusted_pricing: +10 columns
ALTER TABLE "cpi_adjusted_pricing"
  ADD COLUMN "original_price_date" timestamp,
  ADD COLUMN "original_cpi" numeric(10, 4),
  ADD COLUMN "adjusted_price" numeric(15, 2),
  ADD COLUMN "adjustment_date" timestamp,
  ADD COLUMN "current_cpi" numeric(10, 4),
  ADD COLUMN "cpi_change_percentage" numeric(6, 4),
  ADD COLUMN "adjustment_amount" numeric(15, 2),
  ADD COLUMN "adjustment_approved" boolean NOT NULL DEFAULT false,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp;

-- cpi_data: +10 columns
ALTER TABLE "cpi_data"
  ADD COLUMN "period_month" varchar(2),
  ADD COLUMN "period_date" timestamp,
  ADD COLUMN "cpi_value" numeric(10, 4),
  ADD COLUMN "cpi_change" numeric(6, 4),
  ADD COLUMN "cpi_year_over_year" numeric(6, 4),
  ADD COLUMN "base_year" varchar(4) NOT NULL DEFAULT '',
  ADD COLUMN "source" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "data_quality" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "imported_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "imported_by" varchar(255);

-- fmv_audit_log: +9 columns
ALTER TABLE "fmv_audit_log"
  ADD COLUMN "action_description" text,
  ADD COLUMN "procurement_request_id" uuid,
  ADD COLUMN "bid_id" uuid,
  ADD COLUMN "appraisal_id" uuid,
  ADD COLUMN "performed_by" varchar(255),
  ADD COLUMN "performed_by_role" varchar(50),
  ADD COLUMN "compliance_impact" varchar(20),
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "ip_address" varchar(45);

-- fmv_benchmarks: +16 columns
ALTER TABLE "fmv_benchmarks"
  ADD COLUMN "item_description" text,
  ADD COLUMN "item_specifications" jsonb,
  ADD COLUMN "fmv_low" numeric(15, 2),
  ADD COLUMN "fmv_high" numeric(15, 2),
  ADD COLUMN "fmv_median" numeric(15, 2),
  ADD COLUMN "region" varchar(50),
  ADD COLUMN "city" varchar(100),
  ADD COLUMN "effective_from" timestamp,
  ADD COLUMN "effective_to" timestamp,
  ADD COLUMN "data_sources" jsonb,
  ADD COLUMN "comparable_transactions" jsonb,
  ADD COLUMN "cpi_adjusted" boolean NOT NULL DEFAULT false,
  ADD COLUMN "original_fmv" numeric(15, 2),
  ADD COLUMN "cpi_adjustment_factor" numeric(10, 6),
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "reviewed_at" timestamp;

-- fmv_policy: +7 columns
ALTER TABLE "fmv_policy"
  ADD COLUMN "minimum_bids_required" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "cpi_escalator_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "cpi_update_frequency" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "cpi_base_year" varchar(4) NOT NULL DEFAULT '',
  ADD COLUMN "appraisal_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN "appraisal_threshold" numeric(15, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "updated_by" varchar(255);

-- fmv_violations: +10 columns
ALTER TABLE "fmv_violations"
  ADD COLUMN "violation_description" text,
  ADD COLUMN "procurement_request_id" uuid,
  ADD COLUMN "transaction_id" uuid,
  ADD COLUMN "severity" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "resolution" text,
  ADD COLUMN "resolved_by" varchar(255),
  ADD COLUMN "resolved_at" timestamp,
  ADD COLUMN "detected_by" varchar(255),
  ADD COLUMN "detected_at" timestamp NOT NULL DEFAULT now();

-- independent_appraisals: +16 columns
ALTER TABLE "independent_appraisals"
  ADD COLUMN "item_description" text,
  ADD COLUMN "item_specifications" jsonb,
  ADD COLUMN "procurement_request_id" uuid,
  ADD COLUMN "appraiser_name" text,
  ADD COLUMN "appraiser_company" text,
  ADD COLUMN "appraiser_credentials" text,
  ADD COLUMN "appraiser_contact" text,
  ADD COLUMN "appraised_value" numeric(15, 2),
  ADD COLUMN "appraisal_method" varchar(50),
  ADD COLUMN "appraisal_date" timestamp,
  ADD COLUMN "appraisal_valid_until" timestamp,
  ADD COLUMN "appraisal_report" text,
  ADD COLUMN "appraisal_notes" text,
  ADD COLUMN "reviewed_by" varchar(255),
  ADD COLUMN "reviewed_at" timestamp,
  ADD COLUMN "review_notes" text;

-- procurement_bids: +14 columns
ALTER TABLE "procurement_bids"
  ADD COLUMN "bidder_phone" varchar(20),
  ADD COLUMN "bid_amount" numeric(15, 2),
  ADD COLUMN "bid_documents" jsonb,
  ADD COLUMN "bid_notes" text,
  ADD COLUMN "bid_valid_until" timestamp,
  ADD COLUMN "fmv_benchmark_id" uuid,
  ADD COLUMN "within_fmv_range" boolean NOT NULL DEFAULT false,
  ADD COLUMN "fmv_variance_percentage" numeric(6, 2),
  ADD COLUMN "evaluation_score" numeric(5, 2),
  ADD COLUMN "evaluation_notes" text,
  ADD COLUMN "evaluated_by" varchar(255),
  ADD COLUMN "evaluated_at" timestamp,
  ADD COLUMN "bid_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "submitted_at" timestamp NOT NULL DEFAULT now();

-- procurement_requests: +19 columns
ALTER TABLE "procurement_requests"
  ADD COLUMN "request_title" text,
  ADD COLUMN "request_description" text,
  ADD COLUMN "requested_by" varchar(255),
  ADD COLUMN "requested_by_department" varchar(100),
  ADD COLUMN "requested_at" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN "estimated_value" numeric(15, 2),
  ADD COLUMN "budget_approved" boolean NOT NULL DEFAULT false,
  ADD COLUMN "approved_by" varchar(255),
  ADD COLUMN "approved_at" timestamp,
  ADD COLUMN "procurement_type" varchar(50),
  ADD COLUMN "procurement_method" varchar(50) NOT NULL DEFAULT '',
  ADD COLUMN "minimum_bids_required" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "bids_received" varchar(2) NOT NULL DEFAULT '',
  ADD COLUMN "bidding_deadline" timestamp,
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "awarded_to" varchar(255),
  ADD COLUMN "awarded_amount" numeric(15, 2),
  ADD COLUMN "awarded_at" timestamp,
  ADD COLUMN "award_justification" text;

-- defensibility_packs: +23 columns
ALTER TABLE "defensibility_packs"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "pack_version" varchar(10) NOT NULL DEFAULT '',
  ADD COLUMN "generated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "generated_by" varchar(255),
  ADD COLUMN "export_format" varchar(10),
  ADD COLUMN "export_purpose" varchar(50),
  ADD COLUMN "requested_by" varchar(255),
  ADD COLUMN "pack_data" jsonb,
  ADD COLUMN "integrity_hash" varchar(64),
  ADD COLUMN "timeline_hash" varchar(64),
  ADD COLUMN "audit_hash" varchar(64),
  ADD COLUMN "state_transition_hash" varchar(64),
  ADD COLUMN "verification_status" varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN "last_verified_at" timestamp with time zone,
  ADD COLUMN "verification_attempts" integer,
  ADD COLUMN "download_count" integer,
  ADD COLUMN "last_downloaded_at" timestamp with time zone,
  ADD COLUMN "last_downloaded_by" varchar(255),
  ADD COLUMN "file_size_bytes" integer,
  ADD COLUMN "storage_location" text,
  ADD COLUMN "deleted_at" timestamp with time zone,
  ADD COLUMN "deleted_by" varchar(255),
  ADD COLUMN "deletion_reason" text;

-- pack_download_log: +12 columns
ALTER TABLE "pack_download_log"
  ADD COLUMN "organization_id" uuid,
  ADD COLUMN "downloaded_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "downloaded_by" varchar(255),
  ADD COLUMN "downloaded_by_role" varchar(50),
  ADD COLUMN "download_purpose" varchar(100),
  ADD COLUMN "ip_address" varchar(45),
  ADD COLUMN "user_agent" text,
  ADD COLUMN "export_format" varchar(10),
  ADD COLUMN "file_size_bytes" integer,
  ADD COLUMN "integrity_verified" boolean,
  ADD COLUMN "download_success" boolean,
  ADD COLUMN "error_message" text;

-- pack_verification_log: +8 columns
ALTER TABLE "pack_verification_log"
  ADD COLUMN "verified_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN "verified_by" varchar(255),
  ADD COLUMN "verification_passed" boolean,
  ADD COLUMN "expected_hash" varchar(64),
  ADD COLUMN "actual_hash" varchar(64),
  ADD COLUMN "failure_reason" text,
  ADD COLUMN "tampered_fields" jsonb,
  ADD COLUMN "verification_trigger" varchar(50);

-- support_tickets: +22 columns
ALTER TABLE "support_tickets"
  ADD COLUMN "organization_name" varchar(255),
  ADD COLUMN "requestor_user_id" text,
  ADD COLUMN "requestor_email" varchar(255),
  ADD COLUMN "requestor_name" varchar(255),
  ADD COLUMN "source" ticket_source,
  ADD COLUMN "assigned_to_user_id" text,
  ADD COLUMN "assigned_to_name" varchar(255),
  ADD COLUMN "assigned_at" timestamp with time zone,
  ADD COLUMN "sla_response_by" timestamp with time zone,
  ADD COLUMN "sla_resolve_by" timestamp with time zone,
  ADD COLUMN "closed_at" timestamp with time zone,
  ADD COLUMN "response_sla_breach" boolean,
  ADD COLUMN "resolution_sla_breach" boolean,
  ADD COLUMN "response_time_minutes" integer,
  ADD COLUMN "resolution_time_minutes" integer,
  ADD COLUMN "tags" jsonb,
  ADD COLUMN "attachments" jsonb,
  ADD COLUMN "satisfaction_comment" text,
  ADD COLUMN "satisfaction_responded_at" timestamp with time zone,
  ADD COLUMN "metadata" jsonb,
  ADD COLUMN "created_by" text,
  ADD COLUMN "updated_by" text;

-- integration_api_keys: +6 columns
ALTER TABLE "integration_api_keys"
  ADD COLUMN "description" text,
  ADD COLUMN "key_hash" varchar(64),
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "usage_count" integer,
  ADD COLUMN "revoked_at" timestamp,
  ADD COLUMN "revoked_by" varchar(255);

-- integration_webhooks: +7 columns
ALTER TABLE "integration_webhooks"
  ADD COLUMN "description" text,
  ADD COLUMN "secret" varchar(255),
  ADD COLUMN "is_active" boolean,
  ADD COLUMN "delivery_count" integer,
  ADD COLUMN "last_success_at" timestamp,
  ADD COLUMN "last_failure_at" timestamp,
  ADD COLUMN "created_by" varchar(255);

COMMIT;