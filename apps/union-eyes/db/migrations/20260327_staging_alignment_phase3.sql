-- ============================================================================
-- Staging Schema Alignment — Phase 3
-- Purpose: Fix grievance_deadlines missing columns + type mismatch
-- The staging table was created from the workflow schema (35 cols) but
-- the canonical Drizzle definition (grievance-schema.ts) and local DB
-- have columns that the workflow variant omits.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  RAISE NOTICE 'Starting staging alignment phase 3 (grievance_deadlines) — %', now();
END $$;

-- 1. Add extension_granted (boolean, default false)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_deadlines' AND column_name = 'extension_granted' AND table_schema = 'public'
  ) THEN
    ALTER TABLE grievance_deadlines ADD COLUMN extension_granted BOOLEAN DEFAULT false;
    RAISE NOTICE 'grievance_deadlines: added extension_granted';
  ELSE
    RAISE NOTICE 'grievance_deadlines: extension_granted already exists';
  END IF;
END $$;

-- 2. Add new_deadline (timestamptz, nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_deadlines' AND column_name = 'new_deadline' AND table_schema = 'public'
  ) THEN
    ALTER TABLE grievance_deadlines ADD COLUMN new_deadline TIMESTAMPTZ;
    RAISE NOTICE 'grievance_deadlines: added new_deadline';
  ELSE
    RAISE NOTICE 'grievance_deadlines: new_deadline already exists';
  END IF;
END $$;

-- 3. Add reminders_sent (jsonb, nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grievance_deadlines' AND column_name = 'reminders_sent' AND table_schema = 'public'
  ) THEN
    ALTER TABLE grievance_deadlines ADD COLUMN reminders_sent JSONB;
    RAISE NOTICE 'grievance_deadlines: added reminders_sent';
  ELSE
    RAISE NOTICE 'grievance_deadlines: reminders_sent already exists';
  END IF;
END $$;

-- 4. Fix reminder_days type: integer → integer[] (array)
-- The canonical Drizzle schema defines this as integer("reminder_days").array()
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'grievance_deadlines' AND column_name = 'reminder_days' AND table_schema = 'public';

  IF col_type = 'integer' THEN
    -- Drop default first (integer default can't auto-cast to integer[])
    ALTER TABLE grievance_deadlines ALTER COLUMN reminder_days DROP DEFAULT;
    -- Convert existing integer values to single-element arrays
    ALTER TABLE grievance_deadlines ALTER COLUMN reminder_days TYPE INTEGER[] USING
      CASE WHEN reminder_days IS NOT NULL THEN ARRAY[reminder_days] ELSE NULL END;
    RAISE NOTICE 'grievance_deadlines: converted reminder_days from integer to integer[]';
  ELSIF col_type = 'ARRAY' THEN
    RAISE NOTICE 'grievance_deadlines: reminder_days already ARRAY type';
  ELSE
    RAISE NOTICE 'grievance_deadlines: reminder_days type is % — skipping', col_type;
  END IF;
END $$;

-- 5. Verification
DO $$
DECLARE
  col_count integer;
BEGIN
  SELECT count(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'grievance_deadlines' AND table_schema = 'public'
  AND column_name IN ('extension_granted', 'new_deadline', 'reminders_sent');

  IF col_count = 3 THEN
    RAISE NOTICE '✓ grievance_deadlines: all 3 missing columns added — ALIGNED';
  ELSE
    RAISE WARNING '✗ grievance_deadlines: only % of 3 columns found', col_count;
  END IF;
END $$;

COMMIT;

DO $$ BEGIN
  RAISE NOTICE 'Staging alignment phase 3 complete — %', now();
END $$;
