-- Cora-owned Farmer 360 profile context and non-destructive assertion storage.
-- This artifact is forward-only and has not been applied to any environment.
-- Assertion persistence must insert its Cora evidence row and assertion row atomically.

BEGIN;

CREATE TABLE "cora_farmer360_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE RESTRICT,
  "subject_ref" jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_farmer360_profiles_org_id_uidx" UNIQUE ("org_id", "id"),
  CONSTRAINT "cora_farmer360_profiles_subject_ref_ck" CHECK (COALESCE(
    jsonb_typeof("subject_ref") = 'object'
    AND length(btrim("subject_ref"->>'system')) > 0
    AND length(btrim("subject_ref"->>'recordId')) > 0,
    FALSE
  ))
);

CREATE UNIQUE INDEX "cora_farmer360_profiles_subject_uidx"
  ON "cora_farmer360_profiles" (
    "org_id",
    ("subject_ref"->>'system'),
    ("subject_ref"->>'recordId')
  );
CREATE INDEX "cora_farmer360_profiles_org_updated_idx"
  ON "cora_farmer360_profiles" ("org_id", "updated_at");

CREATE TABLE "cora_farmer360_context_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "enterprise_context" jsonb NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_farmer360_context_versions_org_id_uidx" UNIQUE ("org_id", "id"),
  CONSTRAINT "cora_farmer360_context_versions_profile_fk"
    FOREIGN KEY ("org_id", "profile_id")
    REFERENCES "cora_farmer360_profiles"("org_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "cora_farmer360_context_versions_effective_period_ck"
    CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "cora_farmer360_context_versions_context_ck"
    CHECK (jsonb_typeof("enterprise_context") = 'object')
);

CREATE INDEX "cora_farmer360_context_versions_profile_effective_idx"
  ON "cora_farmer360_context_versions" ("org_id", "profile_id", "effective_from");

CREATE TABLE "cora_farmer360_assertions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "subject" text NOT NULL,
  "statement" text NOT NULL,
  "purpose" text NOT NULL,
  "consent_ref" text NOT NULL,
  "evidence_id" uuid NOT NULL,
  "evidence_payload_sha256" varchar(64) NOT NULL,
  "verification_state" varchar(20) NOT NULL DEFAULT 'unverified',
  "asserted_by" text NOT NULL,
  "asserted_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_farmer360_assertions_org_id_uidx" UNIQUE ("org_id", "id"),
  CONSTRAINT "cora_farmer360_assertions_profile_fk"
    FOREIGN KEY ("org_id", "profile_id")
    REFERENCES "cora_farmer360_profiles"("org_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "cora_farmer360_assertions_evidence_fk"
    FOREIGN KEY ("org_id", "evidence_id", "evidence_payload_sha256")
    REFERENCES "cora_evidence_records"("org_id", "id", "payload_sha256") ON DELETE RESTRICT,
  CONSTRAINT "cora_farmer360_assertions_verification_state_ck"
    CHECK ("verification_state" = 'unverified'),
  CONSTRAINT "cora_farmer360_assertions_evidence_sha256_ck"
    CHECK ("evidence_payload_sha256" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "cora_farmer360_assertions_profile_time_idx"
  ON "cora_farmer360_assertions" ("org_id", "profile_id", "asserted_at");

CREATE FUNCTION "cora_reject_farmer360_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CORA_FARMER360_HISTORY_IMMUTABLE: append a new version or assertion';
END;
$$;

CREATE TRIGGER "cora_farmer360_context_versions_immutable"
  BEFORE UPDATE OR DELETE ON "cora_farmer360_context_versions"
  FOR EACH ROW EXECUTE FUNCTION "cora_reject_farmer360_history_mutation"();

CREATE TRIGGER "cora_farmer360_assertions_immutable"
  BEFORE UPDATE OR DELETE ON "cora_farmer360_assertions"
  FOR EACH ROW EXECUTE FUNCTION "cora_reject_farmer360_history_mutation"();

COMMIT;
