-- Rollback for 0057_workbook_holder_notice_evidence. The evidence level of each recorded notice is discarded; 0055's notice_state (recorded or not)
-- is untouched, so every recorded notice reads again as merely recorded. Export first if the delivery evidence is wanted.
ALTER TABLE public.workbook_memory_holders DROP CONSTRAINT IF EXISTS workbook_memory_holders_notice_evidence_check;
ALTER TABLE public.workbook_memory_holders
  DROP COLUMN IF EXISTS notice_provider_reference,
  DROP COLUMN IF EXISTS notice_verified_by,
  DROP COLUMN IF EXISTS notice_verified_at,
  DROP COLUMN IF EXISTS notice_evidence;
