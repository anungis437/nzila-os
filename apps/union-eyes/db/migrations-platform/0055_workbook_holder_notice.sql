-- PLATFORM_SQL 0055_workbook_holder_notice
--
-- The workbook names the people who hold an institution's knowledge (a role, optionally a display name and notes). They are third parties to
-- whoever typed them in and, until now, nothing recorded whether they were ever told they are recorded. How and by whom they must be told is
-- an institutional and legal decision this migration does not make. It makes the fact visible and durable: each holder carries whether a
-- notice has been RECORDED, by whom, when, through which channel and with what reference, and every existing row starts as 'not_recorded'.
--
--   * notice_state is 'not_recorded' (the default, and the honest state of every existing row) or 'notified'.
--   * 'notified' needs who recorded it, when and the channel: the constraint refuses a half-recorded notice.
--   * It records that a notice was RECORDED by a person with authority over the claimed workbook, not that the person read it.
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.workbook_memory_holders') IS NULL THEN
    RAISE EXCEPTION 'workbook holder notice fail-closed: public.workbook_memory_holders does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.workbook_memory_holders
  ADD COLUMN IF NOT EXISTS notice_state varchar(16) NOT NULL DEFAULT 'not_recorded',
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_by varchar(255),
  ADD COLUMN IF NOT EXISTS notice_channel varchar(32),
  ADD COLUMN IF NOT EXISTS notice_reference varchar(255);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workbook_memory_holders_notice_check' AND conrelid = 'public.workbook_memory_holders'::regclass
  ) THEN
    ALTER TABLE public.workbook_memory_holders
      ADD CONSTRAINT workbook_memory_holders_notice_check CHECK (
        notice_state IN ('not_recorded', 'notified')
        AND ((notice_state = 'notified') = (notified_at IS NOT NULL AND notified_by IS NOT NULL AND notice_channel IS NOT NULL))
      );
  END IF;
END $$;
