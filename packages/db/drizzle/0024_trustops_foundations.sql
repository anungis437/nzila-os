-- Migration 0024: TrustCore TrustOps v1 Foundations
-- Adds mandates, creditors, proofs of claim, and stage history tables for TrustOps.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trustops_mandate_stage') THEN
    CREATE TYPE "trustops_mandate_stage" AS ENUM (
      'mandate_intake',
      'engagement_signed',
      'asset_inventory',
      'creditor_list_published',
      'proofs_of_claim_collection',
      'claims_classification',
      'restructuring_plan_drafted',
      'stakeholder_review',
      'court_filing',
      'distribution',
      'discharge',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trustops_creditor_classification') THEN
    CREATE TYPE "trustops_creditor_classification" AS ENUM (
      'secured',
      'unsecured',
      'priority',
      'subordinated',
      'equity'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trustops_proof_of_claim_status') THEN
    CREATE TYPE "trustops_proof_of_claim_status" AS ENUM (
      'submitted',
      'under_review',
      'classified',
      'admitted',
      'partially_admitted',
      'rejected',
      'withdrawn'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trustops_transition_trigger') THEN
    CREATE TYPE "trustops_transition_trigger" AS ENUM (
      'manual',
      'automatic',
      'deadline',
      'approval',
      'rejection'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "trustops_mandates" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      UUID NOT NULL REFERENCES "orgs"("id"),
  "stage"       "trustops_mandate_stage" NOT NULL DEFAULT 'mandate_intake',
  "name"        TEXT NOT NULL,
  "debtor_name" TEXT,
  "opened_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closed_at"   TIMESTAMPTZ,
  "metadata"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "trustops_mandates_org_idx"       ON "trustops_mandates" ("org_id");
CREATE INDEX IF NOT EXISTS "trustops_mandates_org_stage_idx" ON "trustops_mandates" ("org_id", "stage");

CREATE TABLE IF NOT EXISTS "trustops_creditors" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"               UUID NOT NULL REFERENCES "orgs"("id"),
  "mandate_id"           UUID NOT NULL REFERENCES "trustops_mandates"("id") ON DELETE CASCADE,
  "name"                 TEXT NOT NULL,
  "classification"       "trustops_creditor_classification" NOT NULL,
  "contact"              JSONB NOT NULL DEFAULT '{}'::jsonb,
  "claim_amount_cents"   BIGINT,
  "approved_amount_cents" BIGINT,
  "currency"             TEXT NOT NULL DEFAULT 'CAD',
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "trustops_creditors_org_idx"           ON "trustops_creditors" ("org_id");
CREATE INDEX IF NOT EXISTS "trustops_creditors_mandate_idx"       ON "trustops_creditors" ("mandate_id");
CREATE INDEX IF NOT EXISTS "trustops_creditors_org_class_idx"     ON "trustops_creditors" ("org_id", "classification");

CREATE TABLE IF NOT EXISTS "trustops_proofs_of_claim" (
  "id"                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                      UUID NOT NULL REFERENCES "orgs"("id"),
  "mandate_id"                  UUID NOT NULL REFERENCES "trustops_mandates"("id") ON DELETE CASCADE,
  "creditor_id"                 UUID NOT NULL REFERENCES "trustops_creditors"("id") ON DELETE CASCADE,
  "status"                      "trustops_proof_of_claim_status" NOT NULL DEFAULT 'submitted',
  "amount_claimed_cents"        BIGINT,
  "amount_admitted_cents"       BIGINT,
  "currency"                    TEXT NOT NULL DEFAULT 'CAD',
  "evidence_event_id"           UUID,
  "classification_decision_id"  UUID,
  "notes"                       TEXT,
  "submitted_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "trustops_pocs_org_idx"         ON "trustops_proofs_of_claim" ("org_id");
CREATE INDEX IF NOT EXISTS "trustops_pocs_mandate_idx"     ON "trustops_proofs_of_claim" ("mandate_id");
CREATE INDEX IF NOT EXISTS "trustops_pocs_creditor_idx"    ON "trustops_proofs_of_claim" ("creditor_id");
CREATE INDEX IF NOT EXISTS "trustops_pocs_org_status_idx"  ON "trustops_proofs_of_claim" ("org_id", "status");

CREATE TABLE IF NOT EXISTS "trustops_mandate_stage_history" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"         UUID NOT NULL REFERENCES "orgs"("id"),
  "mandate_id"     UUID NOT NULL REFERENCES "trustops_mandates"("id") ON DELETE CASCADE,
  "from_stage"     "trustops_mandate_stage",
  "to_stage"       "trustops_mandate_stage" NOT NULL,
  "trigger"        "trustops_transition_trigger" NOT NULL,
  "reason"         TEXT,
  "actor_user_id"  TEXT NOT NULL,
  "occurred_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "trustops_stage_history_org_idx"            ON "trustops_mandate_stage_history" ("org_id");
CREATE INDEX IF NOT EXISTS "trustops_stage_history_mandate_time_idx"   ON "trustops_mandate_stage_history" ("mandate_id", "occurred_at");
