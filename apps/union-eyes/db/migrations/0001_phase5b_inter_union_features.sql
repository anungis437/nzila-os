DO $$ BEGIN
 CREATE TYPE "public"."claim_priority" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."claim_status" AS ENUM('submitted', 'under_review', 'assigned', 'investigation', 'pending_documentation', 'resolved', 'rejected', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."claim_type" AS ENUM('grievance_discipline', 'grievance_schedule', 'grievance_pay', 'workplace_safety', 'discrimination_age', 'discrimination_gender', 'discrimination_race', 'discrimination_disability', 'harassment_verbal', 'harassment_physical', 'harassment_sexual', 'contract_dispute', 'retaliation', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."member_role" AS ENUM('member', 'steward', 'officer', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'on-leave');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."digest_frequency" AS ENUM('immediate', 'daily', 'weekly', 'never');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'in-app', 'multi');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'partial', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."attendee_status" AS ENUM('invited', 'accepted', 'declined', 'tentative', 'no_response');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."calendar_permission" AS ENUM('owner', 'editor', 'viewer', 'none');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_type" AS ENUM('meeting', 'appointment', 'deadline', 'reminder', 'task', 'hearing', 'mediation', 'negotiation', 'training', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."room_status" AS ENUM('available', 'booked', 'maintenance', 'unavailable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sync_status" AS ENUM('synced', 'pending', 'failed', 'disconnected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'urgent', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deadline_priority" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deadline_status" AS ENUM('pending', 'completed', 'missed', 'extended', 'waived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."delivery_method" AS ENUM('email', 'sms', 'push', 'in_app');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'bounced');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."extension_status" AS ENUM('pending', 'approved', 'denied', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."report_category" AS ENUM('claims', 'members', 'financial', 'compliance', 'performance', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."report_format" AS ENUM('pdf', 'excel', 'csv', 'json', 'html');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."report_type" AS ENUM('custom', 'template', 'system', 'scheduled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."schedule_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_updates" (
	"update_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"update_type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"created_by" uuid NOT NULL,
	"is_internal" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claims" (
	"claim_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar(50) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"is_anonymous" boolean DEFAULT true,
	"claim_type" "claim_type" NOT NULL,
	"status" "claim_status" DEFAULT 'submitted' NOT NULL,
	"priority" "claim_priority" DEFAULT 'medium' NOT NULL,
	"incident_date" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"desired_outcome" text NOT NULL,
	"witnesses_present" boolean DEFAULT false,
	"witness_details" text,
	"previously_reported" boolean DEFAULT false,
	"previous_report_details" text,
	"assigned_to" uuid,
	"assigned_at" timestamp with time zone,
	"ai_score" integer,
	"ai_analysis" jsonb,
	"merit_confidence" integer,
	"precedent_match" integer,
	"complexity_score" integer,
	"progress" integer DEFAULT 0,
	"claim_amount" varchar(20),
	"settlement_amount" varchar(20),
	"legal_costs" varchar(20),
	"court_costs" varchar(20),
	"resolution_outcome" varchar(100),
	"filed_date" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"voice_transcriptions" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone,
	CONSTRAINT "claims_claim_number_unique" UNIQUE("claim_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"department" varchar(100),
	"position" varchar(200),
	"hire_date" timestamp,
	"membership_number" varchar(50),
	"seniority" text,
	"union_join_date" timestamp,
	"preferred_contact_method" varchar(20) DEFAULT 'email',
	"metadata" text,
	"search_vector" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"action_label" text,
	"action_url" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"tenant_id" text,
	"recipient" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" text,
	"template" text,
	"status" "notification_status" NOT NULL,
	"error" text,
	"sent_at" timestamp NOT NULL,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"claim_updates" boolean DEFAULT true NOT NULL,
	"document_updates" boolean DEFAULT true NOT NULL,
	"deadline_alerts" boolean DEFAULT true NOT NULL,
	"system_announcements" boolean DEFAULT true NOT NULL,
	"security_alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"location_url" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" varchar(100) DEFAULT 'America/New_York',
	"is_all_day" boolean DEFAULT false,
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" text,
	"recurrence_exceptions" jsonb,
	"parent_event_id" uuid,
	"event_type" "event_type" DEFAULT 'meeting',
	"status" "event_status" DEFAULT 'scheduled',
	"priority" varchar(20) DEFAULT 'normal',
	"claim_id" text,
	"case_number" text,
	"member_id" text,
	"meeting_room_id" uuid,
	"meeting_url" text,
	"meeting_password" text,
	"agenda" text,
	"organizer_id" text NOT NULL,
	"reminders" jsonb DEFAULT '[15]'::jsonb,
	"external_event_id" text,
	"external_provider" varchar(50),
	"external_html_link" text,
	"last_sync_at" timestamp,
	"is_private" boolean DEFAULT false,
	"visibility" varchar(20) DEFAULT 'default',
	"metadata" jsonb,
	"attachments" jsonb,
	"created_by" text NOT NULL,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_sharing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"shared_with_user_id" text,
	"shared_with_email" text,
	"shared_with_role" varchar(50),
	"permission" "calendar_permission" DEFAULT 'viewer',
	"can_create_events" boolean DEFAULT false,
	"can_edit_events" boolean DEFAULT false,
	"can_delete_events" boolean DEFAULT false,
	"can_share" boolean DEFAULT false,
	"invited_by" text NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3B82F6',
	"icon" varchar(50),
	"owner_id" text NOT NULL,
	"is_personal" boolean DEFAULT true,
	"is_shared" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"external_provider" varchar(50),
	"external_calendar_id" text,
	"sync_enabled" boolean DEFAULT false,
	"last_sync_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'disconnected',
	"sync_token" text,
	"timezone" varchar(100) DEFAULT 'America/New_York',
	"default_event_duration" integer DEFAULT 60,
	"reminder_default_minutes" integer DEFAULT 15,
	"allow_overlap" boolean DEFAULT true,
	"require_approval" boolean DEFAULT false,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
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
CREATE TABLE IF NOT EXISTS "event_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"reminder_minutes" integer NOT NULL,
	"reminder_type" varchar(20) DEFAULT 'notification',
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_email" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scope" text,
	"sync_enabled" boolean DEFAULT true,
	"sync_direction" varchar(20) DEFAULT 'both',
	"last_sync_at" timestamp,
	"next_sync_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'synced',
	"sync_error" text,
	"sync_past_days" integer DEFAULT 30,
	"sync_future_days" integer DEFAULT 365,
	"sync_only_free_time" boolean DEFAULT false,
	"calendar_mappings" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meeting_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"description" text,
	"building_name" varchar(200),
	"floor" varchar(50),
	"room_number" varchar(50),
	"address" text,
	"capacity" integer DEFAULT 10,
	"features" jsonb,
	"equipment" jsonb,
	"status" "room_status" DEFAULT 'available',
	"is_active" boolean DEFAULT true,
	"requires_approval" boolean DEFAULT false,
	"min_booking_duration" integer DEFAULT 30,
	"max_booking_duration" integer DEFAULT 480,
	"advance_booking_days" integer DEFAULT 90,
	"operating_hours" jsonb,
	"allowed_user_roles" jsonb,
	"blocked_dates" jsonb,
	"contact_person_id" text,
	"contact_email" text,
	"contact_phone" varchar(20),
	"image_url" text,
	"floor_plan_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "room_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"event_id" uuid,
	"tenant_id" text NOT NULL,
	"booked_by" text NOT NULL,
	"booked_for" text,
	"purpose" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"setup_required" boolean DEFAULT false,
	"setup_time" integer DEFAULT 0,
	"catering_required" boolean DEFAULT false,
	"catering_notes" text,
	"special_requests" text,
	"status" "event_status" DEFAULT 'scheduled',
	"requires_approval" boolean DEFAULT false,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadline_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"alert_type" varchar(100) NOT NULL,
	"alert_severity" "alert_severity" NOT NULL,
	"alert_trigger" varchar(100) NOT NULL,
	"recipient_id" uuid NOT NULL,
	"recipient_role" varchar(100),
	"delivery_method" "delivery_method" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"delivery_error" text,
	"viewed_at" timestamp,
	"acknowledged_at" timestamp,
	"action_taken" varchar(255),
	"action_taken_at" timestamp,
	"subject" varchar(500),
	"message" text,
	"action_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadline_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"requested_days" integer NOT NULL,
	"request_reason" text NOT NULL,
	"status" "extension_status" DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_by" uuid,
	"approval_decision_at" timestamp,
	"approval_notes" text,
	"new_deadline" timestamp,
	"days_granted" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadline_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rule_code" varchar(100) NOT NULL,
	"description" text,
	"claim_type" varchar(100),
	"priority_level" varchar(50),
	"step_number" integer,
	"days_from_event" integer NOT NULL,
	"event_type" varchar(100) DEFAULT 'claim_filed' NOT NULL,
	"business_days_only" boolean DEFAULT true NOT NULL,
	"allows_extension" boolean DEFAULT true NOT NULL,
	"max_extension_days" integer DEFAULT 30 NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"escalate_to_role" varchar(100),
	"escalation_delay_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_rule" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"deadline_rule_id" uuid,
	"deadline_name" varchar(255) NOT NULL,
	"deadline_type" varchar(100) NOT NULL,
	"event_date" timestamp NOT NULL,
	"original_deadline" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"status" "deadline_status" DEFAULT 'pending' NOT NULL,
	"priority" "deadline_priority" DEFAULT 'medium' NOT NULL,
	"extension_count" integer DEFAULT 0 NOT NULL,
	"total_extension_days" integer DEFAULT 0 NOT NULL,
	"last_extension_date" timestamp,
	"last_extension_reason" text,
	"completed_by" uuid,
	"completion_notes" text,
	"is_overdue" boolean DEFAULT false NOT NULL,
	"days_until_due" integer,
	"days_overdue" integer DEFAULT 0 NOT NULL,
	"escalated_at" timestamp,
	"escalated_to" uuid,
	"alert_count" integer DEFAULT 0 NOT NULL,
	"last_alert_sent" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(255),
	"holiday_date" timestamp NOT NULL,
	"holiday_name" varchar(255) NOT NULL,
	"holiday_type" varchar(100) NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"applies_to" varchar(100) DEFAULT 'all' NOT NULL,
	"is_observed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"executed_by" uuid NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"parameters" jsonb,
	"result_count" varchar(50),
	"execution_time_ms" varchar(50),
	"file_url" varchar(500),
	"file_size" varchar(50),
	"status" varchar(50) DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_with" uuid,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_execute" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "report_category" NOT NULL,
	"config" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"thumbnail" varchar(500),
	"tags" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"report_type" "report_type" DEFAULT 'custom' NOT NULL,
	"category" "report_category" DEFAULT 'custom' NOT NULL,
	"config" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"last_run_at" timestamp,
	"run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"day_of_week" varchar(20),
	"day_of_month" varchar(20),
	"time_of_day" varchar(10) NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"recipients" jsonb NOT NULL,
	"parameters" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_executed_at" timestamp,
	"next_execution_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clause_comparisons_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"clause_ids" uuid[] NOT NULL,
	"comparison_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clause_library_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_id" uuid NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_clause_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_organization_id" uuid NOT NULL,
	"source_cba_id" uuid,
	"original_clause_id" uuid,
	"clause_number" varchar(50),
	"clause_title" varchar(500) NOT NULL,
	"clause_text" text NOT NULL,
	"clause_type" varchar(100) NOT NULL,
	"is_anonymized" boolean DEFAULT false,
	"original_employer_name" varchar(200),
	"anonymized_employer_name" varchar(200),
	"sharing_level" varchar(50) DEFAULT 'private' NOT NULL,
	"shared_with_org_ids" uuid[],
	"effective_date" date,
	"expiry_date" date,
	"sector" varchar(100),
	"province" varchar(2),
	"view_count" integer DEFAULT 0,
	"citation_count" integer DEFAULT 0,
	"comparison_count" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"previous_version_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arbitration_precedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_organization_id" uuid NOT NULL,
	"source_decision_id" uuid,
	"case_number" varchar(100),
	"case_title" varchar(500) NOT NULL,
	"decision_date" date NOT NULL,
	"is_parties_anonymized" boolean DEFAULT false,
	"union_name" varchar(200),
	"employer_name" varchar(200),
	"arbitrator_name" varchar(200) NOT NULL,
	"tribunal" varchar(200),
	"jurisdiction" varchar(50) NOT NULL,
	"grievance_type" varchar(100) NOT NULL,
	"issue_summary" text NOT NULL,
	"union_position" text,
	"employer_position" text,
	"outcome" varchar(50) NOT NULL,
	"decision_summary" text NOT NULL,
	"reasoning" text,
	"key_findings" text[],
	"precedent_level" varchar(50) DEFAULT 'low' NOT NULL,
	"cited_cases" uuid[],
	"citation_count" integer DEFAULT 0,
	"decision_document_url" text,
	"redacted_document_url" text,
	"is_member_names_redacted" boolean DEFAULT true,
	"grievor_names" text[],
	"sharing_level" varchar(50) DEFAULT 'federation' NOT NULL,
	"shared_with_org_ids" uuid[],
	"sector" varchar(100),
	"industry" varchar(100),
	"bargaining_unit_size" varchar(50),
	"view_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "precedent_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"precedent_id" uuid NOT NULL,
	"citing_claim_id" uuid,
	"citing_precedent_id" uuid,
	"citing_organization_id" uuid NOT NULL,
	"citation_context" text,
	"citation_type" varchar(50),
	"cited_by" uuid NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "precedent_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"precedent_id" uuid NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cross_org_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_organization_id" uuid NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_owner_org_id" uuid NOT NULL,
	"access_type" varchar(50) NOT NULL,
	"sharing_level" varchar(50),
	"was_grant_explicit" boolean DEFAULT false,
	"ip_address" varchar(45),
	"user_agent" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_sharing_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grantor_org_id" uuid NOT NULL,
	"grantee_org_id" uuid NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"all_resources" boolean DEFAULT false,
	"specific_resource_ids" uuid[],
	"grant_reason" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_sharing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enable_clause_sharing" boolean DEFAULT false,
	"default_clause_sharing_level" varchar(50) DEFAULT 'private',
	"auto_anonymize_clauses" boolean DEFAULT true,
	"enable_precedent_sharing" boolean DEFAULT false,
	"default_precedent_sharing_level" varchar(50) DEFAULT 'federation',
	"always_redact_member_names" boolean DEFAULT true,
	"enable_analytics_sharing" boolean DEFAULT false,
	"share_member_counts" boolean DEFAULT false,
	"share_financial_data" boolean DEFAULT false,
	"share_claims_data" boolean DEFAULT false,
	"share_strike_data" boolean DEFAULT false,
	"last_modified_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_sharing_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
-- Removed user_management schema references - using organization terminology in public schema
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_updates" ADD CONSTRAINT "claim_updates_claim_id_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("claim_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_sharing" ADD CONSTRAINT "calendar_sharing_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_meeting_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clause_comparisons_history" ADD CONSTRAINT "clause_comparisons_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clause_library_tags" ADD CONSTRAINT "clause_library_tags_clause_id_shared_clause_library_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."shared_clause_library"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	 SELECT 1
	 FROM information_schema.tables
	 WHERE table_schema = 'public'
		  AND table_name = 'collective_agreements'
 ) THEN
	 ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_source_cba_id_collective_agreements_id_fk" FOREIGN KEY ("source_cba_id") REFERENCES "public"."collective_agreements"("id") ON DELETE no action ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_previous_version_id_shared_clause_library_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."shared_clause_library"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arbitration_precedents" ADD CONSTRAINT "arbitration_precedents_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	 SELECT 1
	 FROM information_schema.tables
	 WHERE table_schema = 'public'
		  AND table_name = 'arbitration_decisions'
 ) THEN
	 ALTER TABLE "arbitration_precedents" ADD CONSTRAINT "arbitration_precedents_source_decision_id_arbitration_decisions_id_fk" FOREIGN KEY ("source_decision_id") REFERENCES "public"."arbitration_decisions"("id") ON DELETE no action ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'precedent_citations'
		AND column_name = 'citing_precedent_id'
 ) THEN
	ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_citing_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("citing_precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE set null ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'precedent_citations'
		AND column_name = 'citing_organization_id'
 ) THEN
	ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_citing_organization_id_organizations_id_fk" FOREIGN KEY ("citing_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "precedent_tags" ADD CONSTRAINT "precedent_tags_precedent_id_arbitration_precedents_id_fk" FOREIGN KEY ("precedent_id") REFERENCES "public"."arbitration_precedents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cross_org_access_log" ADD CONSTRAINT "cross_org_access_log_user_organization_id_organizations_id_fk" FOREIGN KEY ("user_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'cross_org_access_log'
		AND column_name = 'resource_owner_org_id'
 ) THEN
	ALTER TABLE "cross_org_access_log" ADD CONSTRAINT "cross_org_access_log_resource_owner_org_id_organizations_id_fk" FOREIGN KEY ("resource_owner_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'organization_sharing_grants'
		AND column_name = 'grantor_org_id'
 ) THEN
	ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantor_org_id_organizations_id_fk" FOREIGN KEY ("grantor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'organization_sharing_grants'
		AND column_name = 'grantee_org_id'
 ) THEN
	ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantee_org_id_organizations_id_fk" FOREIGN KEY ("grantee_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_sharing_settings" ADD CONSTRAINT "organization_sharing_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clause_comparisons_user" ON "clause_comparisons_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clause_comparisons_org" ON "clause_comparisons_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clause_tags_clause" ON "clause_library_tags" USING btree ("clause_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clause_tags_name" ON "clause_library_tags" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shared_clauses_org" ON "shared_clause_library" USING btree ("source_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shared_clauses_type" ON "shared_clause_library" USING btree ("clause_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shared_clauses_sharing" ON "shared_clause_library" USING btree ("sharing_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shared_clauses_sector" ON "shared_clause_library" USING btree ("sector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shared_clauses_province" ON "shared_clause_library" USING btree ("province");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_org" ON "arbitration_precedents" USING btree ("source_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_type" ON "arbitration_precedents" USING btree ("grievance_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_outcome" ON "arbitration_precedents" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_arbitrator" ON "arbitration_precedents" USING btree ("arbitrator_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_jurisdiction" ON "arbitration_precedents" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_sharing" ON "arbitration_precedents" USING btree ("sharing_level");--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'arbitration_precedents'
		AND column_name = 'precedent_level'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_precedents_level" ON "arbitration_precedents" USING btree ("precedent_level");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedents_sector" ON "arbitration_precedents" USING btree ("sector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_citations_precedent" ON "precedent_citations" USING btree ("precedent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_citations_claim" ON "precedent_citations" USING btree ("citing_claim_id");--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'precedent_citations'
		AND column_name = 'citing_organization_id'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_citations_org" ON "precedent_citations" USING btree ("citing_organization_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedent_tags_precedent" ON "precedent_tags" USING btree ("precedent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_precedent_tags_name" ON "precedent_tags" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_log_user" ON "cross_org_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_log_user_org" ON "cross_org_access_log" USING btree ("user_organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_log_resource" ON "cross_org_access_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'cross_org_access_log'
		AND column_name = 'resource_owner_org_id'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_access_log_owner" ON "cross_org_access_log" USING btree ("resource_owner_org_id");
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'cross_org_access_log'
		AND column_name = 'accessed_at'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_access_log_date" ON "cross_org_access_log" USING btree ("accessed_at");
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'organization_sharing_grants'
		AND column_name = 'grantor_org_id'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_sharing_grants_grantor" ON "organization_sharing_grants" USING btree ("grantor_org_id");
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.columns
	WHERE table_schema = 'public'
		AND table_name = 'organization_sharing_grants'
		AND column_name = 'grantee_org_id'
 ) THEN
	CREATE INDEX IF NOT EXISTS "idx_sharing_grants_grantee" ON "organization_sharing_grants" USING btree ("grantee_org_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sharing_grants_resource" ON "organization_sharing_grants" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sharing_grants_expires" ON "organization_sharing_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sharing_settings_org" ON "organization_sharing_settings" USING btree ("organization_id");--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
	SELECT 1
	FROM information_schema.tables
	WHERE table_schema = 'public'
		AND table_name = 'profiles'
 ) THEN
	ALTER TABLE "profiles" DROP COLUMN IF EXISTS "role";
	ALTER TABLE "profiles" DROP COLUMN IF EXISTS "is_system_admin";
	ALTER TABLE "profiles" DROP COLUMN IF EXISTS "organization_id";
	ALTER TABLE "profiles" DROP COLUMN IF EXISTS "permissions";
 END IF;
END $$;