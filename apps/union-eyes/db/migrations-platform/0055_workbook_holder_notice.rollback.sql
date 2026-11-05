-- Rollback for 0055_workbook_holder_notice. The recorded notices are discarded and every named person is again "not recorded"; export them
-- first. The workbook, its holders and everything else are untouched.
ALTER TABLE public.workbook_memory_holders DROP CONSTRAINT IF EXISTS workbook_memory_holders_notice_check;
ALTER TABLE public.workbook_memory_holders
  DROP COLUMN IF EXISTS notice_reference,
  DROP COLUMN IF EXISTS notice_channel,
  DROP COLUMN IF EXISTS notified_by,
  DROP COLUMN IF EXISTS notified_at,
  DROP COLUMN IF EXISTS notice_state;
