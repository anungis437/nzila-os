-- PLATFORM_SQL 0044_anti_scab_author
--
-- anti_scab_violations recorded no author: the reporter was whatever reported_by_id and reported_by_name the request body
-- carried (reported_by_id is uuid, and application principals are text identifiers, so a real session user could not be stored
-- there at all). created_by (text) is added so the server records who filed the violation from the session. Additive and
-- nullable: existing rows keep a NULL author and nothing is backfilled. A relation that does not exist is skipped. Idempotent.
-- Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.anti_scab_violations') IS NOT NULL THEN
    ALTER TABLE public.anti_scab_violations ADD COLUMN IF NOT EXISTS created_by text;
  END IF;
END $$;