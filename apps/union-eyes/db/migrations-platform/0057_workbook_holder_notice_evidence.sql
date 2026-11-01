-- PLATFORM_SQL 0057_workbook_holder_notice_evidence
--
-- 0055 recorded that a notice to a named person was RECORDED, by whom and through which channel, as notice_state = 'notified'. That is the
-- recording person's statement: nothing delivered or confirmed it. This separates what a record rests on:
--
--   * notice_evidence = 'none'               no notice is recorded (every row's honest default).
--   * notice_evidence = 'self_reported'      a person with authority over the claimed workbook said the person was told. Nothing confirmed it.
--   * notice_evidence = 'delivery_verified'  a registered delivery verifier confirmed it; the provider, its reference and the time are kept.
--
-- Every row that 0055 recorded as 'notified' becomes 'self_reported': it is relabelled for what it is, not upgraded. No row can become
-- 'delivery_verified' here, and the constraint refuses a delivery-verified row without its provider evidence or a notice-evidence row that
-- 0055's state does not agree with. Nothing is sent, and no person is marked as told.
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.workbook_memory_holders') IS NULL THEN
    RAISE EXCEPTION 'workbook holder notice evidence fail-closed: public.workbook_memory_holders does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workbook_memory_holders' AND column_name = 'notice_state') THEN
    RAISE EXCEPTION 'workbook holder notice evidence fail-closed: platform 0055 has not been applied (notice_state is missing).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.workbook_memory_holders
  ADD COLUMN IF NOT EXISTS notice_evidence varchar(24) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS notice_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notice_verified_by varchar(64),
  ADD COLUMN IF NOT EXISTS notice_provider_reference varchar(255);
--> statement-breakpoint
UPDATE public.workbook_memory_holders SET notice_evidence = 'self_reported' WHERE notice_state = 'notified' AND notice_evidence = 'none';
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workbook_memory_holders_notice_evidence_check' AND conrelid = 'public.workbook_memory_holders'::regclass
  ) THEN
    ALTER TABLE public.workbook_memory_holders
      ADD CONSTRAINT workbook_memory_holders_notice_evidence_check CHECK (
        notice_evidence IN ('none', 'self_reported', 'delivery_verified')
        AND ((notice_evidence = 'none') = (notice_state = 'not_recorded'))
        AND ((notice_evidence = 'delivery_verified') = (notice_verified_at IS NOT NULL AND notice_verified_by IS NOT NULL AND notice_provider_reference IS NOT NULL))
      );
  END IF;
END $$;
