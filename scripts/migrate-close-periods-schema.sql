-- Align legacy close_periods table with canonical Drizzle schema
-- Source of truth: packages/db/src/schema/finance.ts (closePeriods)

-- Ensure enum contains the canonical pending_approval value expected by app code.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'close_period_status'
      AND e.enumlabel = 'pending_approval'
  ) THEN
    ALTER TYPE close_period_status ADD VALUE 'pending_approval';
  END IF;
END $$;

ALTER TABLE close_periods
  ADD COLUMN IF NOT EXISTS period_label varchar(20),
  ADD COLUMN IF NOT EXISTS period_type varchar(10),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS opened_by text,
  ADD COLUMN IF NOT EXISTS closed_by text;

-- Backfill from legacy year/month/started_at/closed_at columns where possible.
UPDATE close_periods
SET period_label = COALESCE(
      period_label,
      CASE
        WHEN year IS NOT NULL AND month IS NOT NULL
          THEN LPAD(year::text, 4, '0') || '-' || LPAD(month::text, 2, '0')
        ELSE NULL
      END,
      TO_CHAR(COALESCE(started_at, created_at, now()), 'YYYY-MM')
    ),
    period_type = COALESCE(period_type, 'month'),
    start_date = COALESCE(
      start_date,
      started_at::date,
      CASE
        WHEN year IS NOT NULL AND month IS NOT NULL
          THEN make_date(year, GREATEST(1, LEAST(12, month)), 1)
        ELSE date_trunc('month', COALESCE(created_at, now()))::date
      END
    ),
    opened_by = COALESCE(opened_by, 'system:migrated')
WHERE period_label IS NULL
   OR period_type IS NULL
   OR start_date IS NULL
   OR opened_by IS NULL;

UPDATE close_periods
SET end_date = COALESCE(
      end_date,
      closed_at::date,
      (date_trunc('month', start_date::timestamp) + INTERVAL '1 month - 1 day')::date
    )
WHERE end_date IS NULL;

ALTER TABLE close_periods
  ALTER COLUMN period_label SET NOT NULL,
  ALTER COLUMN period_type SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN opened_by SET NOT NULL;
