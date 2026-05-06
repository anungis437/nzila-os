-- Migration 0019: TrustCore policies table + onboarding timestamp
-- Adds:
--   - trustcore_policies  (generated privacy + data-governance policies)
--   - onboarding_completed_at column on trustcore_privacy_programs

-- Policy type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_policy_type') THEN
    CREATE TYPE "tc_policy_type" AS ENUM ('privacy_policy', 'data_governance');
  END IF;
END$$;

-- Policies table
CREATE TABLE IF NOT EXISTS "trustcore_policies" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"        UUID NOT NULL REFERENCES "orgs"("id"),
  "type"          "tc_policy_type" NOT NULL,
  "content"       TEXT NOT NULL,
  "version"       INTEGER NOT NULL DEFAULT 1,
  "generated_by"  TEXT NOT NULL DEFAULT 'system',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_policies_org_idx"      ON "trustcore_policies" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_policies_org_type_idx" ON "trustcore_policies" ("org_id", "type");

-- Add onboarding_completed_at to trustcore_privacy_programs (nullable)
ALTER TABLE "trustcore_privacy_programs"
  ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ;
