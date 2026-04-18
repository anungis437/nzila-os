-- Orchestrator runtime hardening
-- 1) DB-native idempotency key scoped by org
-- 2) optimistic concurrency/version tracking
-- 3) execution lease ownership for restart + multi-instance safety
-- 4) org-scoped event indexing for operator console timelines

ALTER TABLE "automation_commands"
  ADD COLUMN IF NOT EXISTS "org_id" uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "execution_owner" text,
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;

-- Backfill for pre-hardening rows.
UPDATE "automation_commands"
SET
  "org_id" = COALESCE(
    "org_id",
    NULLIF("args"->>'orgId', '')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  "idempotency_key" = COALESCE("idempotency_key", "correlation_id"::text)
WHERE "org_id" IS NULL OR "idempotency_key" IS NULL;

ALTER TABLE "automation_commands"
  ALTER COLUMN "org_id" SET NOT NULL,
  ALTER COLUMN "idempotency_key" SET NOT NULL;

-- The old correlation_id uniqueness blocks multiple independent requests.
DROP INDEX IF EXISTS "automation_commands_correlation_id_unique";
CREATE INDEX IF NOT EXISTS "automation_commands_correlation_idx"
  ON "automation_commands" USING btree ("correlation_id");

CREATE UNIQUE INDEX IF NOT EXISTS "automation_commands_org_idempotency_uidx"
  ON "automation_commands" USING btree ("org_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "automation_commands_org_status_idx"
  ON "automation_commands" USING btree ("org_id", "status");

CREATE INDEX IF NOT EXISTS "automation_commands_status_updated_idx"
  ON "automation_commands" USING btree ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "automation_commands_lease_idx"
  ON "automation_commands" USING btree ("status", "lease_expires_at");

ALTER TABLE "automation_events"
  ADD COLUMN IF NOT EXISTS "org_id" uuid;

UPDATE "automation_events" e
SET "org_id" = c."org_id"
FROM "automation_commands" c
WHERE e."command_id" = c."id" AND e."org_id" IS NULL;

ALTER TABLE "automation_events"
  ALTER COLUMN "org_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "automation_events_org_created_idx"
  ON "automation_events" USING btree ("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "automation_events_command_created_idx"
  ON "automation_events" USING btree ("command_id", "created_at");
