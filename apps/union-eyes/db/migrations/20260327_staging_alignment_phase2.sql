-- ============================================================================
-- Staging Schema Alignment — Phase 2
-- Purpose: Fix remaining BaseModel gaps found during full audit
-- Tables: claim_updates (missing id + updated_at, PK=update_id),
--         grievance_transitions (missing created_at + updated_at)
-- Created: 2026-03-27
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE 'Starting staging alignment phase 2 — %', now();
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. CLAIM_UPDATES — Add id (BaseModel PK), updated_at, swap PK
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. Add id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_updates' AND column_name = 'id' AND table_schema = 'public'
  ) THEN
    ALTER TABLE claim_updates ADD COLUMN id UUID DEFAULT gen_random_uuid();
    UPDATE claim_updates SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE claim_updates ALTER COLUMN id SET NOT NULL;
    ALTER TABLE claim_updates ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'claim_updates: added id column';
  ELSE
    RAISE NOTICE 'claim_updates: id column already exists';
  END IF;
END $$;

-- 1b. Add updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_updates' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE claim_updates ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    RAISE NOTICE 'claim_updates: added updated_at column';
  ELSE
    RAISE NOTICE 'claim_updates: updated_at already exists';
  END IF;
END $$;

-- 1c. Swap PK from update_id to id (no FKs reference this table)
DO $$
DECLARE
  pk_col text;
BEGIN
  SELECT a.attname INTO pk_col
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.claim_updates'::regclass AND c.contype = 'p';

  IF pk_col = 'update_id' THEN
    ALTER TABLE claim_updates DROP CONSTRAINT claim_updates_pkey;
    ALTER TABLE claim_updates ADD PRIMARY KEY (id);
    -- Keep update_id as UNIQUE (preserves existing references)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.claim_updates'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%update_id%'
    ) THEN
      ALTER TABLE claim_updates ADD CONSTRAINT claim_updates_update_id_key UNIQUE (update_id);
    END IF;
    RAISE NOTICE 'claim_updates: swapped PK from update_id to id';
  ELSE
    RAISE NOTICE 'claim_updates: PK already on % — no swap needed', pk_col;
  END IF;
END $$;

-- 1d. Relax NOT NULL to match Django model (ClaimUpdates is a stub — few required fields)
ALTER TABLE claim_updates ALTER COLUMN update_type DROP NOT NULL;
ALTER TABLE claim_updates ALTER COLUMN message DROP NOT NULL;
ALTER TABLE claim_updates ALTER COLUMN created_by DROP NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. GRIEVANCE_TRANSITIONS — Add missing created_at + updated_at
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_transitions' AND column_name = 'created_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE grievance_transitions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    RAISE NOTICE 'grievance_transitions: added created_at column';
  ELSE
    RAISE NOTICE 'grievance_transitions: created_at already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_transitions' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE grievance_transitions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    RAISE NOTICE 'grievance_transitions: added updated_at column';
  ELSE
    RAISE NOTICE 'grievance_transitions: updated_at already exists';
  END IF;
END $$;

-- Relax transitioned_by NOT NULL to match local (nullable on local)
ALTER TABLE grievance_transitions ALTER COLUMN transitioned_by DROP NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Verification
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  cu_pk text;
  cu_has_id boolean;
  gt_has_created boolean;
  gt_has_updated boolean;
BEGIN
  -- claim_updates
  SELECT a.attname INTO cu_pk
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.claim_updates'::regclass AND c.contype = 'p';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_updates' AND column_name = 'id' AND table_schema = 'public'
  ) INTO cu_has_id;

  IF cu_pk = 'id' AND cu_has_id THEN
    RAISE NOTICE '✓ claim_updates: PK=id, id column present — ALIGNED';
  ELSE
    RAISE WARNING '✗ claim_updates: PK=%, has_id=% — MISALIGNED', cu_pk, cu_has_id;
  END IF;

  -- grievance_transitions
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_transitions' AND column_name = 'created_at' AND table_schema = 'public'
  ) INTO gt_has_created;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_transitions' AND column_name = 'updated_at' AND table_schema = 'public'
  ) INTO gt_has_updated;

  IF gt_has_created AND gt_has_updated THEN
    RAISE NOTICE '✓ grievance_transitions: created_at + updated_at present — ALIGNED';
  ELSE
    RAISE WARNING '✗ grievance_transitions: created_at=%, updated_at=% — MISALIGNED', gt_has_created, gt_has_updated;
  END IF;
END $$;

COMMIT;

DO $$ BEGIN
  RAISE NOTICE 'Staging alignment phase 2 complete — %', now();
END $$;
