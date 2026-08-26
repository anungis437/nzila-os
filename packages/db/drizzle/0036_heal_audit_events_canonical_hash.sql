-- 0036_heal_audit_events_canonical_hash.sql
--
-- Phase 0A.1 healer for PH0-OPEN-008.
--
-- Root-cause defect in 0032_audit_events_canonical_hash.sql (line 43):
--
--   CREATE INDEX IF NOT EXISTS "audit_events_org_occurred_idx"
--     ON "audit_events" ("org_id", "occurred_at");
--
-- The audit_events table was created in 0000_initial.sql WITHOUT an
-- `org_id` column (see packages/db/drizzle/0000_initial.sql line 242).
-- No SQL migration between 0000 and 0032 adds one. The historical dev
-- database has org_id NOT NULL because a `drizzle-kit push` operation
-- was performed out-of-band — a materialization path that Phase 0A has
-- explicitly ruled out as authoritative.
--
-- Phase 0A.1 empirical finding (clean-DB replay in
-- reports/audits/cupe-national-phase-0/migration-clean-run.log):
-- PostgreSQL 14+ executes multi-statement Query messages in a single
-- implicit transaction, so 0032's runtime error rolls back ALL of
-- 0032 — including the ADD COLUMN occurred_at and ADD COLUMN
-- hash_version that precede the failing CREATE INDEX. On an empty
-- database 0032 commits nothing. (The dev DB masked this because prior
-- out-of-band DDL had already added occurred_at, hash_version, and
-- org_id.)
--
-- Consequently this healer restores the FULL intended terminal state
-- of 0032, not only the CREATE INDEX statement:
--
--   FULLY RESTORED by this healer:
--     - audit_events.occurred_at  timestamptz NOT NULL DEFAULT now()
--     - audit_events.hash_version text        NOT NULL DEFAULT
--                                             'linkage-only-v0'
--     - audit_events.org_id       uuid NOT NULL REFERENCES orgs(id)
--     - Index audit_events_org_occurred_idx on (org_id, occurred_at)
-- Design contract:
--   * Forward-only (does not modify 0032).
--   * Idempotent: safe on empty DB (no rows to backfill), on the 0032-
--     partial state (occurred_at & hash_version already present), and on
--     a fully-healed DB.
--   * Backfill strategy: no natural org_id source exists on the
--     historical schema (the `entities` table has no org_id and the
--     `entity_members` table has no org_id either). Empty DB has zero
--     rows so backfill is trivially satisfied. For populated databases
--     with rows lacking org_id, the guarded SET NOT NULL below refuses
--     rather than silently masking a data-safety gap; the operator is
--     told exactly how many rows need attention.
--   * Preserves audit chain integrity: does not touch existing rows'
--     hash, previous_hash, occurred_at, or hash_version values.

BEGIN;

-- (0) Restore the two columns 0032 was meant to add. On any empty replay
--     0032 committed nothing (PG 14+ multi-statement Query messages run
--     in a single implicit transaction — see the empirical finding in
--     reports/audits/cupe-national-phase-0/migration-clean-run.log).
--     Defaults match 0032's originals exactly so pre-existing rows
--     receive the same back-fill semantics.
ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "occurred_at"  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "hash_version" text        NOT NULL DEFAULT 'linkage-only-v0';

-- (1) Add org_id column (nullable — SET NOT NULL is applied later after
--     backfill succeeds or is refused with an operator message).
ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "org_id" uuid;

-- (2) Ensure the FK constraint to orgs(id) exists (guarded so re-runs on
--     an already-healed DB are no-ops). The constraint is added BEFORE
--     SET NOT NULL so an operator running against a partially-backfilled
--     DB gets referential-integrity protection immediately.
DO $healer_0036_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'audit_events'
       AND c.conname = 'audit_events_org_id_orgs_id_fk'
  ) THEN
    ALTER TABLE "audit_events"
      ADD CONSTRAINT "audit_events_org_id_orgs_id_fk"
      FOREIGN KEY ("org_id") REFERENCES "orgs"("id");
  END IF;
END
$healer_0036_fk$;

-- (3) Guarded SET NOT NULL. Empty DB → trivially satisfied. Populated
--     DB with NULLs → refuses with a clear operator message rather than
--     silently leaving the column nullable (which would diverge from
--     the canonical TS schema declaration).
DO $healer_0036_notnull$
DECLARE
  null_count integer;
  is_nullable_now text;
BEGIN
  SELECT count(*) INTO null_count
    FROM "audit_events" WHERE "org_id" IS NULL;

  SELECT is_nullable INTO is_nullable_now
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name  = 'audit_events'
     AND column_name = 'org_id';

  IF is_nullable_now = 'YES' THEN
    IF null_count = 0 THEN
      ALTER TABLE "audit_events" ALTER COLUMN "org_id" SET NOT NULL;
    ELSE
      RAISE EXCEPTION
        'healer 0036: audit_events has % row(s) with NULL org_id; refusing to SET NOT NULL. Backfill manually (there is no natural historical source) and re-run.',
        null_count;
    END IF;
  END IF;
END
$healer_0036_notnull$;

-- (4) Recreate the index that 0032 skipped.
CREATE INDEX IF NOT EXISTS "audit_events_org_occurred_idx"
  ON "audit_events" ("org_id", "occurred_at");

-- (5) Hash-stability assertion. The canonical hash of any existing
--     canonical-v1 row is a function of (org_id, occurred_at, action,
--     actor_user_id, actor_role, after_json, target_id, target_type,
--     previous_hash) — see apps/abr/lib/audit-log.ts. Because this
--     healer does not touch hash, previous_hash, occurred_at,
--     hash_version, or any payload column of pre-existing rows, hash
--     verifiability is preserved. This DO block is a defensive
--     runtime assertion that no schema drift has silently occurred
--     on the columns that participate in canonical hashing.
DO $healer_0036_hash_columns$
DECLARE
  missing_cols text[];
BEGIN
  SELECT ARRAY(
    SELECT c FROM (VALUES
      ('id'), ('org_id'), ('actor_user_id'), ('actor_role'),
      ('action'), ('target_type'), ('target_id'),
      ('before_json'), ('after_json'),
      ('hash'), ('previous_hash'),
      ('created_at'), ('occurred_at'), ('hash_version')
    ) AS v(c)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='audit_events' AND column_name = v.c
    )
  ) INTO missing_cols;
  IF array_length(missing_cols, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'healer 0036: audit_events is missing canonical-hash column(s): %', missing_cols;
  END IF;
END
$healer_0036_hash_columns$;

COMMIT;
