-- Migration 0022: TrustCore leads table
-- Captures pre-onboarding email leads (soft gate).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_lead_source') THEN
    CREATE TYPE "tc_lead_source" AS ENUM ('landing', 'sample_trust_center', 'onboarding');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "trustcore_leads" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         TEXT NOT NULL,
  "source"        "tc_lead_source" NOT NULL DEFAULT 'landing',
  "captured_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "converted_at"  TIMESTAMPTZ,
  "org_id"        UUID REFERENCES "orgs"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "tc_leads_email_idx"        ON "trustcore_leads" ("email");
CREATE        INDEX IF NOT EXISTS "tc_leads_captured_at_idx"  ON "trustcore_leads" ("captured_at" DESC);
