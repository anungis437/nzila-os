-- TEST_ONLY
-- NON_PRODUCTION
-- NON_MIGRATION
-- DISPOSABLE
--
-- Minimal prerequisites for the Cora Farmer 360 acceptance database.
-- Definitions are kept aligned with packages/db/src/schema/{orgs,operations,agri}.ts.
-- This is not a platform bootstrap and must never be applied outside the
-- dedicated cora-farmer360-acceptance Compose database.

DO $acceptance_database_guard$
BEGIN
  IF current_database() <> 'cora_farmer360_acceptance' THEN
    RAISE EXCEPTION 'Refusing Farmer 360 acceptance bootstrap outside its disposable database';
  END IF;
END
$acceptance_database_guard$;

CREATE TYPE "org_status" AS ENUM ('active', 'inactive');

CREATE TABLE "orgs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_org_id" varchar(255),
  "legal_name" text NOT NULL,
  "jurisdiction" varchar(10) NOT NULL,
  "incorporation_number" text,
  "registered_office_address" jsonb,
  "fiscal_year_end" varchar(5),
  "policy_config" jsonb DEFAULT '{}'::jsonb,
  "status" "org_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "orgs_clerk_org_id_unique" UNIQUE ("clerk_org_id")
);

CREATE SCHEMA "user_management";

CREATE TABLE "user_management"."users" (
  "user_id" varchar(255) PRIMARY KEY,
  "email" varchar(255) NOT NULL UNIQUE,
  "is_active" boolean NOT NULL DEFAULT true,
  "lifecycle_state" varchar(20) NOT NULL DEFAULT 'active'
);

CREATE TYPE "agri_producer_status" AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE "agri_producers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "name" text NOT NULL,
  "contact_phone" text,
  "contact_email" text,
  "location" jsonb,
  "cooperative_id" uuid,
  "status" "agri_producer_status" DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id"),
  "actor_user_id" text NOT NULL,
  "actor_role" text,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid,
  "before_json" jsonb,
  "after_json" jsonb,
  "hash" text NOT NULL,
  "previous_hash" text,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "hash_version" text DEFAULT 'linkage-only-v0' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "audit_events_org_occurred_idx"
  ON "audit_events" ("org_id", "occurred_at");

CREATE FUNCTION "prevent_audit_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_events rows are immutable: % operation is not permitted. Audit records may only be inserted.',
    TG_OP;
END;
$$;

CREATE TRIGGER "audit_events_no_update"
  BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_mutation"();

CREATE TRIGGER "audit_events_no_delete"
  BEFORE DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_mutation"();
