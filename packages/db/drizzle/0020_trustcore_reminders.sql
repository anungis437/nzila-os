-- Migration 0020: TrustCore reminders table
-- Adds operational reminder/alert records for Law 25 obligations.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_reminder_source_type') THEN
    CREATE TYPE "tc_reminder_source_type" AS ENUM (
      'privacy_program', 'pia', 'incident', 'dsr_request', 'vendor', 'policy', 'data_asset'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_reminder_severity') THEN
    CREATE TYPE "tc_reminder_severity" AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_reminder_status') THEN
    CREATE TYPE "tc_reminder_status" AS ENUM ('open', 'completed', 'dismissed', 'overdue');
  END IF;
END$$;

-- Table
CREATE TABLE IF NOT EXISTS "trustcore_reminders" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      UUID NOT NULL REFERENCES "orgs"("id"),
  "source_type" "tc_reminder_source_type" NOT NULL,
  "source_id"   UUID,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "severity"    "tc_reminder_severity" NOT NULL,
  "due_at"      TIMESTAMPTZ,
  "status"      "tc_reminder_status" NOT NULL DEFAULT 'open',
  "action_url"  TEXT,
  "completed_at" TIMESTAMPTZ,
  "dismissed_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_reminders_org_idx"          ON "trustcore_reminders" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_reminders_org_status_idx"   ON "trustcore_reminders" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "tc_reminders_org_due_idx"      ON "trustcore_reminders" ("org_id", "due_at");
CREATE INDEX IF NOT EXISTS "tc_reminders_org_severity_idx" ON "trustcore_reminders" ("org_id", "severity");
