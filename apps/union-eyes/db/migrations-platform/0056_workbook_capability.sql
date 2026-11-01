-- PLATFORM_SQL 0056_workbook_capability
--
-- An unclaimed, pseudonymous workbook was reached by its identifier alone: the id is returned by the public start route, appears in page
-- URLs and checkout redirects, and was the whole credential for the people the workbook names. This adds the separate capability that
-- now plays that part (lib/workbook/workbook-capability.ts), as for the ICRA assessment: only a SHA-256 hash and an expiry are stored; the
-- raw token is returned once, at start. The columns are nullable and additive.
--
--   * A workbook with no capability on record is admitted by nobody on the bearer path. Rows created before this migration have none, so
--     an unclaimed workbook from before it can no longer be reached by its id; claiming it (single-use claim token) is unaffected.
--   * The pair is consistent: a hash without an expiry, or the reverse, is refused.
--   * The claim clears both in the claim's own statement, so the capability never outlives the transition to ownership authority.
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.workbooks') IS NULL THEN
    RAISE EXCEPTION 'workbook capability fail-closed: public.workbooks does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.workbooks
  ADD COLUMN IF NOT EXISTS capability_token_hash varchar(64),
  ADD COLUMN IF NOT EXISTS capability_token_expires_at timestamptz;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workbooks_capability_pair_check' AND conrelid = 'public.workbooks'::regclass
  ) THEN
    ALTER TABLE public.workbooks
      ADD CONSTRAINT workbooks_capability_pair_check CHECK ((capability_token_hash IS NULL) = (capability_token_expires_at IS NULL));
  END IF;
END $$;
