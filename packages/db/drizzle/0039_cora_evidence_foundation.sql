-- Shared immutable methodology history and Cora-owned evidence records.
-- This artifact is forward-only and has not been applied to any environment.

BEGIN;

CREATE TABLE "platform_methodology_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "authority_id" varchar(160) NOT NULL,
  "methodology_id" varchar(160) NOT NULL,
  "version" varchar(80) NOT NULL,
  "name" text NOT NULL,
  "definition_sha256" varchar(64) NOT NULL,
  "definition_ref" text,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "supersedes_version" varchar(80),
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_methodology_authority_version_uidx"
    UNIQUE ("authority_id", "methodology_id", "version"),
  CONSTRAINT "platform_methodology_version_identity_uidx"
    UNIQUE ("id", "authority_id", "methodology_id", "version", "definition_sha256"),
  CONSTRAINT "platform_methodology_definition_sha256_ck"
    CHECK ("definition_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "platform_methodology_effective_period_ck"
    CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "platform_methodology_supersedes_version_fk"
    FOREIGN KEY ("authority_id", "methodology_id", "supersedes_version")
    REFERENCES "platform_methodology_versions"("authority_id", "methodology_id", "version")
    ON DELETE RESTRICT
);

CREATE INDEX "platform_methodology_authority_effective_idx"
  ON "platform_methodology_versions" ("authority_id", "methodology_id", "effective_from");

CREATE FUNCTION "platform_reject_methodology_version_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PLATFORM_METHODOLOGY_VERSION_IMMUTABLE: publish a new version instead';
END;
$$;

CREATE TRIGGER "platform_methodology_versions_immutable"
  BEFORE UPDATE OR DELETE ON "platform_methodology_versions"
  FOR EACH ROW EXECUTE FUNCTION "platform_reject_methodology_version_mutation"();

CREATE TABLE "cora_evidence_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE RESTRICT,
  "evidence_type" varchar(120) NOT NULL,
  "purpose" text NOT NULL,
  "consent_ref" text NOT NULL,
  "source" jsonb NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "valid_from" timestamptz,
  "valid_to" timestamptz,
  "methodology_version_id" uuid NOT NULL,
  "methodology_authority_id" varchar(160) NOT NULL,
  "methodology_id" varchar(160) NOT NULL,
  "methodology_version" varchar(80) NOT NULL,
  "methodology_definition_sha256" varchar(64) NOT NULL,
  "provenance_ref" text NOT NULL,
  "payload_sha256" varchar(64) NOT NULL,
  "evidence_pack_artifact" jsonb,
  "confidence" jsonb NOT NULL,
  "data_quality" jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_evidence_org_id_uidx" UNIQUE ("org_id", "id"),
  CONSTRAINT "cora_evidence_org_id_hash_uidx"
    UNIQUE ("org_id", "id", "payload_sha256"),
  CONSTRAINT "cora_evidence_methodology_version_fk"
    FOREIGN KEY (
      "methodology_version_id",
      "methodology_authority_id",
      "methodology_id",
      "methodology_version",
      "methodology_definition_sha256"
    )
    REFERENCES "platform_methodology_versions"(
      "id",
      "authority_id",
      "methodology_id",
      "version",
      "definition_sha256"
    )
    ON DELETE RESTRICT,
  CONSTRAINT "cora_evidence_payload_sha256_ck"
    CHECK ("payload_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "cora_evidence_valid_period_ck"
    CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from"),
  CONSTRAINT "cora_evidence_confidence_level_ck"
    CHECK (COALESCE(
      "confidence"->>'level' IN ('high', 'medium', 'low', 'unknown')
      AND length(btrim("confidence"->>'basis')) > 0,
      FALSE
    )),
  CONSTRAINT "cora_evidence_quality_dimensions_ck"
    CHECK (COALESCE(
      "data_quality"->>'completeness' IN ('complete', 'partial', 'estimated', 'unknown')
      AND "data_quality"->>'freshness' IN ('current', 'stale', 'unknown')
      AND "data_quality"->>'traceability' IN ('direct', 'derived', 'unknown')
      AND jsonb_typeof("data_quality"->'limitations') = 'array',
      FALSE
    )),
  CONSTRAINT "cora_evidence_source_ref_ck"
    CHECK (COALESCE(
      jsonb_typeof("source") = 'object'
      AND length(btrim("source"->>'system')) > 0
      AND length(btrim("source"->>'recordId')) > 0,
      FALSE
    )),
  CONSTRAINT "cora_evidence_pack_artifact_ref_ck"
    CHECK ("evidence_pack_artifact" IS NULL OR COALESCE(
      length(btrim("evidence_pack_artifact"->>'packId')) > 0
      AND length(btrim("evidence_pack_artifact"->>'artifactId')) > 0
      AND "evidence_pack_artifact"->>'sha256' ~ '^[a-f0-9]{64}$',
      FALSE
    ))
);

CREATE INDEX "cora_evidence_org_observed_idx"
  ON "cora_evidence_records" ("org_id", "observed_at");
CREATE INDEX "cora_evidence_org_methodology_idx"
  ON "cora_evidence_records" ("org_id", "methodology_authority_id", "methodology_id", "methodology_version");

CREATE TABLE "cora_evidence_conclusions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE RESTRICT,
  "conclusion_type" varchar(120) NOT NULL,
  "purpose" text NOT NULL,
  "consent_ref" text NOT NULL,
  "statement" text NOT NULL,
  "outcome" jsonb NOT NULL,
  "methodology_version_id" uuid NOT NULL,
  "methodology_authority_id" varchar(160) NOT NULL,
  "methodology_id" varchar(160) NOT NULL,
  "methodology_version" varchar(80) NOT NULL,
  "methodology_definition_sha256" varchar(64) NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "valid_from" timestamptz,
  "valid_to" timestamptz,
  "confidence" jsonb NOT NULL,
  "data_quality" jsonb NOT NULL,
  "generated_at" timestamptz NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_conclusion_org_id_uidx" UNIQUE ("org_id", "id"),
  CONSTRAINT "cora_conclusion_methodology_version_fk"
    FOREIGN KEY (
      "methodology_version_id",
      "methodology_authority_id",
      "methodology_id",
      "methodology_version",
      "methodology_definition_sha256"
    )
    REFERENCES "platform_methodology_versions"(
      "id",
      "authority_id",
      "methodology_id",
      "version",
      "definition_sha256"
    )
    ON DELETE RESTRICT,
  CONSTRAINT "cora_conclusion_valid_period_ck"
    CHECK ("valid_to" IS NULL OR "valid_from" IS NULL OR "valid_to" >= "valid_from"),
  CONSTRAINT "cora_conclusion_confidence_level_ck"
    CHECK (COALESCE(
      "confidence"->>'level' IN ('high', 'medium', 'low', 'unknown')
      AND length(btrim("confidence"->>'basis')) > 0,
      FALSE
    )),
  CONSTRAINT "cora_conclusion_quality_dimensions_ck"
    CHECK (COALESCE(
      "data_quality"->>'completeness' IN ('complete', 'partial', 'estimated', 'unknown')
      AND "data_quality"->>'freshness' IN ('current', 'stale', 'unknown')
      AND "data_quality"->>'traceability' IN ('direct', 'derived', 'unknown')
      AND jsonb_typeof("data_quality"->'limitations') = 'array',
      FALSE
    )),
  CONSTRAINT "cora_conclusion_outcome_object_ck"
    CHECK (jsonb_typeof("outcome") = 'object')
);

CREATE INDEX "cora_conclusion_org_generated_idx"
  ON "cora_evidence_conclusions" ("org_id", "generated_at");

CREATE TABLE "cora_conclusion_evidence_refs" (
  "org_id" uuid NOT NULL,
  "conclusion_id" uuid NOT NULL,
  "evidence_id" uuid NOT NULL,
  "payload_sha256" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "cora_conclusion_evidence_org_pair_uidx"
    UNIQUE ("org_id", "conclusion_id", "evidence_id"),
  CONSTRAINT "cora_conclusion_evidence_conclusion_fk"
    FOREIGN KEY ("org_id", "conclusion_id")
    REFERENCES "cora_evidence_conclusions"("org_id", "id")
    ON DELETE RESTRICT,
  CONSTRAINT "cora_conclusion_evidence_record_fk"
    FOREIGN KEY ("org_id", "evidence_id", "payload_sha256")
    REFERENCES "cora_evidence_records"("org_id", "id", "payload_sha256")
    ON DELETE RESTRICT,
  CONSTRAINT "cora_conclusion_evidence_sha256_ck"
    CHECK ("payload_sha256" ~ '^[a-f0-9]{64}$')
);

COMMENT ON TABLE "platform_methodology_versions" IS
  'Shared immutable methodology registry. Authorities publish versions; products reference, never rewrite, them.';
COMMENT ON TABLE "cora_evidence_records" IS
  'Cora-owned evidence metadata and immutable references; source payloads remain at their source.';
COMMENT ON TABLE "cora_evidence_conclusions" IS
  'Portable Cora conclusions linked to shared methodology versions and same-org evidence.';

COMMIT;
