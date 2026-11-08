-- UE Gate 0 (DEF-0B10-PIL-DEMO-DATA-INSERTS-FICTIONAL-GRIEVANCES-AND-NAMED-FEDERAL-EMPLOYERS-INTO-THE-LIVE-TABLES-WITH-NO-ROW-MARKER-AND-DELETES-BY-NUMBER-AND-EMAIL-PATTERN):
-- pilot_demo_seeds gains the exact employer/grievance row ids a seed inserted, captured at seed time. The purge route
-- now deletes by this exact id list instead of a GRV-DEMO-/lr-demo@ name/email pattern, so it removes only the rows a
-- seed created. Existing rows (seeded before this column existed) keep employer_ids/grievance_ids NULL; the route
-- falls back to the prior pattern-match purge only for those legacy rows.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
DO $$
BEGIN
  IF to_regclass('pilot_demo_seeds') IS NOT NULL THEN
    ALTER TABLE pilot_demo_seeds
      ADD COLUMN IF NOT EXISTS employer_ids text[],
      ADD COLUMN IF NOT EXISTS grievance_ids text[];
  END IF;
END
$$;
