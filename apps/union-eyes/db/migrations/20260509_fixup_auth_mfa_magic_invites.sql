-- 20260509_fixup_auth_mfa_magic_invites.sql
--
-- Adds the user_management auth-support tables that exist in
-- @nzila/db schema but were never created by Drizzle migrations:
--   - user_management.mfa_totp        (queried on every login)
--   - user_management.mfa_challenges  (issued when MFA required)
--   - user_management.magic_links     (passwordless / email verify)
--   - user_management.invites         (org membership invites)
--
-- Without these, `handleLogin` returns 500 because the MFA query in
-- `login()` hits a missing relation. CI E2E "Login failed status=500"
-- is the symptom this migration fixes.
--
-- All CREATEs are IF NOT EXISTS so this is safe to apply on prod.

CREATE SCHEMA IF NOT EXISTS "user_management";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."mfa_totp" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "secret_encrypted" text NOT NULL,
  "recovery_codes_hashed" jsonb DEFAULT '[]'::jsonb,
  "enabled_at" timestamp with time zone,
  "disabled_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."mfa_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "token_hash" text NOT NULL,
  "method" varchar(20) NOT NULL DEFAULT 'totp',
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "attempts" integer DEFAULT 0,
  "ip_address" varchar(45),
  "user_agent" text,
  "pending_ip" varchar(45),
  "pending_user_agent" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "mfa_challenges_token_hash_unique" UNIQUE ("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."magic_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "user_id" varchar(255),
  "organization_id" uuid,
  "purpose" varchar(32) NOT NULL DEFAULT 'login',
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "consumed_ip" varchar(45),
  "requested_ip" varchar(45),
  "requested_user_agent" text,
  "attempts" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "magic_links_token_hash_unique" UNIQUE ("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "organization_id" uuid NOT NULL,
  "role" varchar(50) NOT NULL DEFAULT 'member',
  "token_hash" text NOT NULL,
  "invited_by" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "accepted_user_id" varchar(255),
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "invites_token_hash_unique" UNIQUE ("token_hash")
);
