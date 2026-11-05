-- PLATFORM_SQL 0021_employer_execution_integrity
--
-- Employer-execution routes enforce, in code, that one remittance package exists per payroll run, that a timesheet file
-- is ingested once per employer and period, and that the person who executes a payroll run is recorded and differs from
-- the preparer and the approvers. Code checks and row locks are not an absolute guarantee, so the same rules are made
-- structural here:
--
--   1. employer_payroll_runs gets executed_by / executed_at, written when a run is sealed (posted), and the pair is
--      constrained to be set together. No value is invented for runs posted before this migration; the sealing route
--      refuses to execute a run unless it can record the executor.
--   2. employer_remittance_runs: at most one remittance run per payroll run.
--   3. employer_timesheet_batches: at most one batch per organization, employer, period and source-file hash.
--
-- Existing duplicates are refused rather than deleted or merged: choosing which record is authoritative is a decision
-- for the institution, not a default.

DO $$
BEGIN
  IF to_regclass('public.employer_payroll_runs') IS NULL
     OR to_regclass('public.employer_remittance_runs') IS NULL
     OR to_regclass('public.employer_timesheet_batches') IS NULL THEN
    RAISE EXCEPTION 'platform 0021 fail-closed: the employer-execution relations (0002) do not exist.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employer_remittance_runs GROUP BY payroll_run_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'platform 0021 fail-closed: a payroll run has more than one remittance run; resolve the duplicates first.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.employer_timesheet_batches
     GROUP BY organization_id, employer_id, period_start, period_end, source_file_hash
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'platform 0021 fail-closed: a timesheet file was ingested more than once for an employer and period; resolve the duplicates first.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.employer_payroll_runs
  ADD COLUMN IF NOT EXISTS executed_by text,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS employer_remittance_runs_one_per_payroll_run_uidx
  ON public.employer_remittance_runs (payroll_run_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS employer_timesheet_batches_file_period_uidx
  ON public.employer_timesheet_batches (organization_id, employer_id, period_start, period_end, source_file_hash);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.employer_payroll_runs'::regclass AND conname = 'employer_payroll_runs_executor_pair'
  ) THEN
    ALTER TABLE public.employer_payroll_runs
      ADD CONSTRAINT employer_payroll_runs_executor_pair
      CHECK ((executed_by IS NULL) = (executed_at IS NULL)) NOT VALID;
  END IF;
END $$;
