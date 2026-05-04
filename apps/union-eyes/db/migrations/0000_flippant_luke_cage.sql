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
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_parent_event_id_calendar_events_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;
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