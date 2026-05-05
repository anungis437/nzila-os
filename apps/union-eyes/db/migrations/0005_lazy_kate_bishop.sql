CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'boolean' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"percentage" integer,
	"allowed_tenants" json,
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
CREATE TABLE IF NOT EXISTS "emergency_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"emergency_type" varchar(50) NOT NULL,
	"severity_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"declared_by_user_id" uuid NOT NULL,
	"declared_at" timestamp NOT NULL,
	"notes" text,
	"affected_locations" jsonb,
	"affected_member_count" integer DEFAULT 0,
	"resolved_at" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"break_glass_activated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cross_border_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"amount_cents" integer NOT NULL,
	"original_currency" varchar(3) DEFAULT 'CAD',
	"cad_equivalent_cents" integer NOT NULL,
	"from_country_code" varchar(2) DEFAULT 'CA' NOT NULL,
	"to_country_code" varchar(2) NOT NULL,
	"from_party_type" varchar(50) NOT NULL,
	"to_party_type" varchar(50) NOT NULL,
	"cra_reporting_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"requires_t106" boolean DEFAULT false NOT NULL,
	"t106_filed" boolean DEFAULT false NOT NULL,
	"t106_filing_date" timestamp,
	"transaction_type" varchar(50),
	"counterparty_name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" varchar(3) NOT NULL,
	"to_currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"exchange_rate" varchar(20) NOT NULL,
	"rate_source" varchar(50) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"rate_timestamp" timestamp NOT NULL,
	"provider" varchar(100),
	"data_quality" varchar(20) DEFAULT 'official',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Removed user_management schema references - using organization terminology in public schema
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
   AND table_name = 'break_glass_activations'
 ) THEN
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "emergency_id" uuid NOT NULL;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "activation_initiated_at" timestamp NOT NULL;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "activation_approved_at" timestamp;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "key_holder_ids" jsonb;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "secret_shares" jsonb;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audited_at" timestamp;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audited_by" uuid;
  ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audit_report" text;

  IF EXISTS (
   SELECT 1
   FROM information_schema.tables
   WHERE table_schema = 'public'
    AND table_name = 'emergency_declarations'
  ) THEN
   ALTER TABLE "break_glass_activations" ADD CONSTRAINT "break_glass_activations_emergency_id_emergency_declarations_id_fk" FOREIGN KEY ("emergency_id") REFERENCES "public"."emergency_declarations"("id") ON DELETE no action ON UPDATE no action;
  END IF;

  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "break_glass_system_id";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "activation_type";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "emergency_level";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "activated_at";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "resolved_at";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "recovery_duration";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_4_user_id";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_4_timestamp";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_4_ip_address";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_5_user_id";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_5_timestamp";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "signature_5_ip_address";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "authorization_complete";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "authorization_completed_at";
  ALTER TABLE "break_glass_activations" DROP COLUMN IF EXISTS "activated_by";
 END IF;
EXCEPTION
 WHEN duplicate_object OR undefined_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voter_eligibility') THEN
    ALTER TABLE "voter_eligibility" DROP CONSTRAINT IF EXISTS "valid_verification_status";
    ALTER TABLE "voter_eligibility" ADD CONSTRAINT "valid_verification_status" CHECK ("voter_eligibility"."verification_status" IN ('pending', 'verified', 'rejected')) NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'votes') THEN
    ALTER TABLE "votes" DROP CONSTRAINT IF EXISTS "valid_voter_type";
    ALTER TABLE "votes" ADD CONSTRAINT "valid_voter_type" CHECK ("votes"."voter_type" IN ('member', 'delegate', 'officer', 'guest')) NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voting_notifications') THEN
    ALTER TABLE "voting_notifications" DROP CONSTRAINT IF EXISTS "valid_notification_type";
    ALTER TABLE "voting_notifications" ADD CONSTRAINT "valid_notification_type" CHECK ("voting_notifications"."type" IN ('session_started', 'session_ending', 'results_available', 'quorum_reached', 'vote_reminder')) NOT VALID;
    ALTER TABLE "voting_notifications" DROP CONSTRAINT IF EXISTS "valid_priority";
    ALTER TABLE "voting_notifications" ADD CONSTRAINT "valid_priority" CHECK ("voting_notifications"."priority" IN ('low', 'medium', 'high', 'urgent')) NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voting_sessions') THEN
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_type";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_type" CHECK ("voting_sessions"."type" IN ('convention', 'ratification', 'special_vote')) NOT VALID;
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_status";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_status" CHECK ("voting_sessions"."status" IN ('draft', 'active', 'paused', 'closed', 'cancelled')) NOT VALID;
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_meeting_type";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_meeting_type" CHECK ("voting_sessions"."meeting_type" IN ('convention', 'ratification', 'emergency', 'special')) NOT VALID;
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_time_range";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_time_range" CHECK ("voting_sessions"."end_time" IS NULL OR "voting_sessions"."start_time" IS NULL OR "voting_sessions"."end_time" > "voting_sessions"."start_time") NOT VALID;
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_scheduled_end";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_scheduled_end" CHECK ("voting_sessions"."scheduled_end_time" IS NULL OR "voting_sessions"."scheduled_end_time" > "voting_sessions"."created_at") NOT VALID;
    ALTER TABLE "voting_sessions" DROP CONSTRAINT IF EXISTS "valid_quorum";
    ALTER TABLE "voting_sessions" ADD CONSTRAINT "valid_quorum" CHECK ("voting_sessions"."quorum_threshold" >= 0 AND "voting_sessions"."quorum_threshold" <= 100) NOT VALID;
  END IF;
EXCEPTION
 WHEN duplicate_object OR undefined_table THEN null;
END $$;
--> statement-breakpoint
-- Removed user_management, tenant_management, and audit_security schema references - using organization terminology in public schema
--> statement-breakpoint
-- Conditional constraint operations for tables that may not exist yet
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_templates') THEN
    ALTER TABLE "sms_templates" DROP CONSTRAINT IF EXISTS "sms_template_message_length";
    ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_template_message_length" CHECK (char_length(message_template) <= 1600) NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recognition_award_types') THEN
    ALTER TABLE "recognition_award_types" DROP CONSTRAINT IF EXISTS "award_type_credit_amount_positive";
    ALTER TABLE "recognition_award_types" ADD CONSTRAINT "award_type_credit_amount_positive" CHECK ("recognition_award_types"."default_credit_amount" > 0) NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reward_budget_envelopes') THEN
    ALTER TABLE "reward_budget_envelopes" DROP CONSTRAINT IF EXISTS "budget_limit_positive";
    ALTER TABLE "reward_budget_envelopes" ADD CONSTRAINT "budget_limit_positive" CHECK ("reward_budget_envelopes"."amount_limit" > 0) NOT VALID;
    ALTER TABLE "reward_budget_envelopes" DROP CONSTRAINT IF EXISTS "budget_used_valid";
    ALTER TABLE "reward_budget_envelopes" ADD CONSTRAINT "budget_used_valid" CHECK ("reward_budget_envelopes"."amount_used" >= 0 AND "reward_budget_envelopes"."amount_used" <= "reward_budget_envelopes"."amount_limit") NOT VALID;
    ALTER TABLE "reward_budget_envelopes" DROP CONSTRAINT IF EXISTS "budget_dates_valid";
    ALTER TABLE "reward_budget_envelopes" ADD CONSTRAINT "budget_dates_valid" CHECK ("reward_budget_envelopes"."ends_at" > "reward_budget_envelopes"."starts_at") NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reward_redemptions') THEN
    ALTER TABLE "reward_redemptions" DROP CONSTRAINT IF EXISTS "redemption_credits_positive";
    ALTER TABLE "reward_redemptions" ADD CONSTRAINT "redemption_credits_positive" CHECK ("reward_redemptions"."credits_spent" > 0) NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reward_wallet_ledger') THEN
    ALTER TABLE "reward_wallet_ledger" DROP CONSTRAINT IF EXISTS "wallet_balance_non_negative";
    ALTER TABLE "reward_wallet_ledger" ADD CONSTRAINT "wallet_balance_non_negative" CHECK ("reward_wallet_ledger"."balance_after" >= 0) NOT VALID;
  END IF;
END $$;