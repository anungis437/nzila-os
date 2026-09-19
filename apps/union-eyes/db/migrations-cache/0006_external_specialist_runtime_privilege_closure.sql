CREATE SCHEMA IF NOT EXISTS "user_management";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."users" (
  "user_id" varchar(255) PRIMARY KEY,
  "email" varchar(255) NOT NULL UNIQUE,
  "email_verified" boolean DEFAULT false,
  "email_verified_at" timestamp with time zone,
  "password_hash" text,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "display_name" varchar(200),
  "avatar_url" text,
  "phone" varchar(20),
  "phone_verified" boolean DEFAULT false,
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
  "account_source" varchar(20) NOT NULL DEFAULT 'local',
  "lifecycle_state" varchar(20) NOT NULL DEFAULT 'active',
  "lifecycle_reason" text,
  "lifecycle_changed_at" timestamp with time zone,
  "lifecycle_changed_by" varchar(255),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_management"."organization_users" (
  "organization_user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "role" varchar(50) DEFAULT 'member' NOT NULL,
  "permissions" jsonb DEFAULT '[]'::jsonb,
  "is_active" boolean DEFAULT true,
  "is_primary" boolean DEFAULT false,
  "invited_by" varchar(255),
  "invited_at" timestamp with time zone,
  "joined_at" timestamp with time zone,
  "last_access_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_users_user_id_organization_id_idx"
  ON "user_management"."organization_users" ("user_id", "organization_id");--> statement-breakpoint
ALTER TABLE "user_management"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_management"."users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_management"."organization_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_management"."organization_users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ue_auth_users_self_select" ON "user_management"."users";--> statement-breakpoint
CREATE POLICY "ue_auth_users_self_select"
  ON "user_management"."users"
  FOR SELECT TO "union_eyes_runtime"
  USING ("user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
DROP POLICY IF EXISTS "ue_auth_organization_users_self_select" ON "user_management"."organization_users";--> statement-breakpoint
CREATE POLICY "ue_auth_organization_users_self_select"
  ON "user_management"."organization_users"
  FOR SELECT TO "union_eyes_runtime"
  USING ("user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
GRANT USAGE ON SCHEMA "user_management" TO "union_eyes_runtime";--> statement-breakpoint
GRANT SELECT ON TABLE "user_management"."users" TO "union_eyes_runtime";--> statement-breakpoint
GRANT SELECT ON TABLE "user_management"."organization_users" TO "union_eyes_runtime";--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "representation_authority_status" AS ENUM ('pending', 'active', 'revoked', 'expired', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "representation_authority_scope" AS ENUM ('grievance', 'wcb_claim');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "external_matter_grant_status" AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "external_document_grant_status" AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "representation_authorities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "matter_type" "representation_authority_scope" NOT NULL,
  "matter_id" uuid NOT NULL,
  "represented_person_id" uuid NOT NULL,
  "representative_user_id" uuid NOT NULL,
  "representative_organization_id" uuid NOT NULL,
  "scope" text[] NOT NULL DEFAULT '{}',
  "source" text NOT NULL DEFAULT 'recorded_authority',
  "status" "representation_authority_status" NOT NULL DEFAULT 'pending',
  "effective_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "superseded_by_authority_id" uuid,
  "evidence_document_id" uuid REFERENCES "documents"("id"),
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT "representation_authorities_revoked_status_ck"
    CHECK (("revoked_at" IS NULL AND "status" <> 'revoked') OR ("revoked_at" IS NOT NULL)),
  CONSTRAINT "representation_authorities_expiry_ck"
    CHECK ("expires_at" IS NULL OR "expires_at" > "effective_at")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_matter_access_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authority_id" uuid NOT NULL REFERENCES "representation_authorities"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "matter_type" "representation_authority_scope" NOT NULL,
  "matter_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "representative_organization_id" uuid NOT NULL,
  "status" "external_matter_grant_status" NOT NULL DEFAULT 'active',
  "can_view" boolean NOT NULL DEFAULT true,
  "can_comment" boolean NOT NULL DEFAULT false,
  "can_upload_documents" boolean NOT NULL DEFAULT false,
  "can_view_documents" boolean NOT NULL DEFAULT false,
  "can_download_documents" boolean NOT NULL DEFAULT false,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "granted_by" uuid NOT NULL,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_matter_grants_revoked_status_ck"
    CHECK (("revoked_at" IS NULL AND "status" <> 'revoked') OR ("revoked_at" IS NOT NULL))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_document_access_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authority_id" uuid NOT NULL REFERENCES "representation_authorities"("id") ON DELETE CASCADE,
  "matter_grant_id" uuid NOT NULL REFERENCES "external_matter_access_grants"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "matter_type" "representation_authority_scope" NOT NULL,
  "matter_id" uuid NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL,
  "representative_organization_id" uuid NOT NULL,
  "status" "external_document_grant_status" NOT NULL DEFAULT 'active',
  "can_view" boolean NOT NULL DEFAULT true,
  "can_download" boolean NOT NULL DEFAULT false,
  "can_share" boolean NOT NULL DEFAULT false,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "granted_by" uuid NOT NULL,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "external_document_grants_revoked_status_ck"
    CHECK (("revoked_at" IS NULL AND "status" <> 'revoked') OR ("revoked_at" IS NOT NULL))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_representation_authorities_org" ON "representation_authorities"("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_representation_authorities_actor" ON "representation_authorities"("representative_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_representation_authorities_matter" ON "representation_authorities"("organization_id", "matter_type", "matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_matter_grants_authority" ON "external_matter_access_grants"("authority_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_matter_grants_org_matter" ON "external_matter_access_grants"("organization_id", "matter_type", "matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_matter_grants_user" ON "external_matter_access_grants"("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_document_grants_authority" ON "external_document_access_grants"("authority_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_document_grants_matter_grant" ON "external_document_access_grants"("matter_grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_document_grants_document" ON "external_document_access_grants"("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_document_grants_user" ON "external_document_access_grants"("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_external_document_grants_org_matter" ON "external_document_access_grants"("organization_id", "matter_type", "matter_id");--> statement-breakpoint
ALTER TABLE "representation_authorities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "representation_authorities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_matter_access_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_matter_access_grants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_document_access_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_document_access_grants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_authorities_select" ON "representation_authorities";--> statement-breakpoint
CREATE POLICY "ue_external_authorities_select"
  ON "representation_authorities"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "representative_user_id"::text = current_setting('app.current_user_id', true)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_matter_grants_select" ON "external_matter_access_grants";--> statement-breakpoint
CREATE POLICY "ue_external_matter_grants_select"
  ON "external_matter_access_grants"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_document_grants_select" ON "external_document_access_grants";--> statement-breakpoint
CREATE POLICY "ue_external_document_grants_select"
  ON "external_document_access_grants"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
  );--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_document_grants_insert_self" ON "external_document_access_grants";--> statement-breakpoint
CREATE POLICY "ue_external_document_grants_insert_self"
  ON "external_document_access_grants"
  FOR INSERT TO "union_eyes_runtime"
  WITH CHECK (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
    AND "granted_by"::text = current_setting('app.current_user_id', true)
  );--> statement-breakpoint
GRANT SELECT ON TABLE "representation_authorities" TO "union_eyes_runtime";--> statement-breakpoint
GRANT SELECT ON TABLE "external_matter_access_grants" TO "union_eyes_runtime";--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "external_document_access_grants" TO "union_eyes_runtime";
