-- 0034_heal_orchestrator_runtime_hardening.sql
--
-- Phase 0A.1 healer for PH0-OPEN-006.
--
-- Root-cause defect in 0013_orchestrator_runtime_hardening.sql (line 34):
--
--   DROP INDEX IF EXISTS "automation_commands_correlation_id_unique";
--
-- The object named `automation_commands_correlation_id_unique` is a UNIQUE
-- CONSTRAINT (declared inline in 0003_redundant_starfox.sql), not a bare
-- index. In PostgreSQL, `DROP INDEX` refuses to drop a constraint-backed
-- unique index and raises:
--   ERROR: cannot drop index automation_commands_correlation_id_unique
--          because constraint automation_commands_correlation_id_unique
--          on table automation_commands requires it
--
-- Phase 0A.1 empirical finding (clean-DB replay in
-- reports/audits/cupe-national-phase-0/migration-clean-run.log):
-- PostgreSQL 14+ executes multi-statement Query messages inside a single
-- implicit transaction, so a runtime error anywhere in 0013 rolls back
-- ALL of 0013's statements — NOT just the tail. On an empty database
-- 0013 commits nothing. (On the pre-existing dev DB, drizzle-kit push
-- had already materialised most columns and indexes out-of-band, which
-- masked this behavior during Phase 0A.)
--
-- Consequently this healer restores the FULL intended terminal state of
-- 0013, not only the tail statements after the failing DROP INDEX:
--
--   FULLY RESTORED by this healer (was intended by 0013):
--     - automation_commands: 9 new columns + deterministic backfill +
--       NOT NULL on org_id and idempotency_key.
--     - automation_commands: correct DROP CONSTRAINT (replaces 0013's
--       broken DROP INDEX) + 5 indexes.
--     - automation_events: org_id column + backfill + NOT NULL + 2
--       indexes.
--
--   Original 0013 statements that this healer supersedes:
--     - DROP INDEX "automation_commands_correlation_id_unique"
--     - CREATE INDEX "automation_commands_correlation_idx"
--     - CREATE UNIQUE INDEX "automation_commands_org_idempotency_uidx"
--     - CREATE INDEX "automation_commands_org_status_idx"
--     - CREATE INDEX "automation_commands_status_updated_idx"
--     - CREATE INDEX "automation_commands_lease_idx"
--     - ALTER TABLE "automation_events" ADD COLUMN "org_id" uuid
--     - UPDATE "automation_events" backfill from "automation_commands"
--     - ALTER TABLE "automation_events" ALTER COLUMN "org_id" SET NOT NULL
--     - CREATE INDEX "automation_events_org_created_idx"
--     - CREATE INDEX "automation_events_command_created_idx"
--
-- Intended terminal state (per canonical TS schema in packages/db/schema):
--   - The old row-scoped uniqueness on correlation_id is REMOVED entirely.
--     Uniqueness is now org-scoped on (org_id, idempotency_key). Correlation
--     ID becomes a non-unique btree lookup key so multiple independent
--     requests can share it.
--   - automation_events carries org_id NOT NULL for org-scoped console
--     timelines.
--
-- Design contract of this healer:
--   * Forward-only (does not modify 0013).
--   * Idempotent: safe on empty DB, on a DB that has 0013's partial state,
--     and on a DB that has already been fully healed.
--   * Uses `ALTER TABLE DROP CONSTRAINT IF EXISTS` — the correct primitive
--     for a constraint-backed index (also drops the underlying unique
--     index, matching 0013's original intent).
--   * Guarded `SET NOT NULL` — refuses to promote automation_events.org_id
--     to NOT NULL if any NULL rows remain after the deterministic backfill.
--     An empty DB has zero rows and this is trivially satisfied.

BEGIN;

-- (0) Restore the 9 automation_commands columns that 0013 was supposed to
--     add. On an empty database these are all missing; on the dev DB most
--     already exist and IF NOT EXISTS makes this a no-op.
ALTER TABLE "automation_commands"
  ADD COLUMN IF NOT EXISTS "org_id"            uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key"   text,
  ADD COLUMN IF NOT EXISTS "version"           integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "attempt_count"     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "execution_owner"   text,
  ADD COLUMN IF NOT EXISTS "lease_expires_at"  timestamptz,
  ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "started_at"        timestamptz,
  ADD COLUMN IF NOT EXISTS "completed_at"      timestamptz;

-- (0b) Deterministic backfill mirroring 0013's intent. Empty DB → no-op.
--      Populated DB → derives org_id from args.orgId JSON payload (falling
--      back to the all-zeros sentinel) and defaults idempotency_key to
--      correlation_id.
UPDATE "automation_commands"
   SET "org_id" = COALESCE(
         "org_id",
         NULLIF("args"->>'orgId', '')::uuid,
         '00000000-0000-0000-0000-000000000000'::uuid
       ),
       "idempotency_key" = COALESCE("idempotency_key", "correlation_id"::text)
 WHERE "org_id" IS NULL OR "idempotency_key" IS NULL;

-- (0c) Guarded promotion to NOT NULL on the two hardened columns. Refuses
--      loudly if any NULL rows remain rather than silently skipping.
DO $healer_0034_commands_notnull$
DECLARE
  null_org integer;
  null_ide integer;
BEGIN
  SELECT count(*) INTO null_org FROM "automation_commands" WHERE "org_id" IS NULL;
  SELECT count(*) INTO null_ide FROM "automation_commands" WHERE "idempotency_key" IS NULL;
  IF null_org > 0 OR null_ide > 0 THEN
    RAISE EXCEPTION
      'healer 0034: automation_commands has % NULL org_id and % NULL idempotency_key row(s); refusing SET NOT NULL',
      null_org, null_ide;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='automation_commands'
       AND column_name='org_id' AND is_nullable='YES'
  ) THEN
    ALTER TABLE "automation_commands" ALTER COLUMN "org_id" SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='automation_commands'
       AND column_name='idempotency_key' AND is_nullable='YES'
  ) THEN
    ALTER TABLE "automation_commands" ALTER COLUMN "idempotency_key" SET NOT NULL;
  END IF;
END
$healer_0034_commands_notnull$;

-- (1) Fix 0013's failing DROP: drop the constraint (which also drops the
--     underlying unique index of the same name). Historical intent is to
--     eliminate row-level uniqueness on correlation_id entirely.
ALTER TABLE "automation_commands"
  DROP CONSTRAINT IF EXISTS "automation_commands_correlation_id_unique";

-- (2) Recreate the 5 automation_commands indexes that 0013 skipped.
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

-- (3) automation_events.org_id — column skipped by 0013.
ALTER TABLE "automation_events"
  ADD COLUMN IF NOT EXISTS "org_id" uuid;

-- (4) Deterministic backfill from the parent automation_commands row.
--     Empty DB: zero rows, no-op. Partial-state DB with events: rows whose
--     parent command has an org_id inherit it. Rows without a parent
--     (should be none due to FK) remain NULL and are surfaced by (5).
UPDATE "automation_events" e
SET "org_id" = c."org_id"
FROM "automation_commands" c
WHERE e."command_id" = c."id" AND e."org_id" IS NULL;

-- (5) Guarded promotion to NOT NULL. Refuses (with a clear operator
--     message) if any NULL rows remain. This preserves audit safety on
--     populated databases while succeeding trivially on empty ones.
DO $healer_0034_events_notnull$
DECLARE
  null_count integer;
  is_nullable_now text;
BEGIN
  SELECT count(*) INTO null_count
    FROM "automation_events" WHERE "org_id" IS NULL;

  SELECT is_nullable INTO is_nullable_now
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name  = 'automation_events'
     AND column_name = 'org_id';

  IF is_nullable_now = 'YES' THEN
    IF null_count = 0 THEN
      ALTER TABLE "automation_events" ALTER COLUMN "org_id" SET NOT NULL;
    ELSE
      RAISE EXCEPTION
        'healer 0034: automation_events has % NULL org_id row(s); refusing to SET NOT NULL. Backfill manually and re-run.',
        null_count;
    END IF;
  END IF;
END
$healer_0034_events_notnull$;

-- (6) Recreate the 2 automation_events indexes that 0013 skipped.
CREATE INDEX IF NOT EXISTS "automation_events_org_created_idx"
  ON "automation_events" USING btree ("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "automation_events_command_created_idx"
  ON "automation_events" USING btree ("command_id", "created_at");

COMMIT;
