-- Migration 0018: TrustCore Compliance Snapshots
-- Immutable point-in-time compliance evaluation records.
-- Used as audit trail, procurement artifacts, and trend analysis.
--
-- Apply manually (postgres):
--   psql $DATABASE_URL -f packages/db/drizzle/0018_trustcore_snapshots.sql

CREATE TABLE IF NOT EXISTS "trustcore_compliance_snapshots" (
  "id"             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"         uuid        NOT NULL REFERENCES "orgs"("id"),
  "score"          integer     NOT NULL,
  "confidence"     integer     NOT NULL,
  "status"         text        NOT NULL,
  "risks"          jsonb       NOT NULL,
  "summary"        jsonb       NOT NULL,
  "risk_count"     integer     NOT NULL,
  "blocking_count" integer     NOT NULL,
  "triggered_by"   text,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_snapshots_org_idx"
  ON "trustcore_compliance_snapshots" ("org_id");

CREATE INDEX IF NOT EXISTS "tc_snapshots_org_created_idx"
  ON "trustcore_compliance_snapshots" ("org_id", "created_at");
