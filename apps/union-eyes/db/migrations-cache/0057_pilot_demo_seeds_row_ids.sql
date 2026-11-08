-- 0057_pilot_demo_seeds_row_ids
--
-- DEF-0B10-PIL-DEMO-DATA-INSERTS-FICTIONAL-GRIEVANCES-AND-NAMED-FEDERAL-EMPLOYERS-INTO-THE-LIVE-TABLES-WITH-NO-ROW-MARKER-AND-DELETES-BY-NUMBER-AND-EMAIL-PATTERN.
-- pilot_demo_seeds gains the exact employer/grievance row ids a seed inserted, captured at seed time (generateDemoEmployers/
-- generateDemoGrievances already assign the id client-side before insert). The purge route deletes by this exact id list instead
-- of a GRV-DEMO-/lr-demo@ name/email pattern, so it removes only the rows a seed created. Existing rows (seeded before this
-- column existed) keep employer_ids/grievance_ids NULL; the route falls back to the prior pattern-match purge only for those
-- legacy rows.
DO $$
BEGIN
  IF to_regclass('public.pilot_demo_seeds') IS NULL THEN
    RAISE EXCEPTION 'cache 0057 fail-closed: public.pilot_demo_seeds does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "pilot_demo_seeds" ADD COLUMN IF NOT EXISTS "employer_ids" text[];
--> statement-breakpoint
ALTER TABLE "pilot_demo_seeds" ADD COLUMN IF NOT EXISTS "grievance_ids" text[];
