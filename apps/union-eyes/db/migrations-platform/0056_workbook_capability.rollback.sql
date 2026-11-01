-- Rollback for 0056_workbook_capability. Every unclaimed workbook loses its capability, and with the capability gone the previous behaviour
-- (the identifier alone is the credential) is what the code of the commit before this migration expects. Claimed workbooks are untouched.
ALTER TABLE public.workbooks DROP CONSTRAINT IF EXISTS workbooks_capability_pair_check;
ALTER TABLE public.workbooks
  DROP COLUMN IF EXISTS capability_token_expires_at,
  DROP COLUMN IF EXISTS capability_token_hash;
