-- PLATFORM_SQL 0051_arbitration_decision_owner
--
-- arbitration_decisions is a shared library with no owner: the application roles could read, rewrite and delete every row whatever
-- is_public or access_restrictions said (the combined bootstrap even creates it as a Django stub holding only case_number). The
-- columns the access rule needs are added, and the library gets an owner:
--
--   * source_organization_id: the organization that supplied the decision (NULL for platform-supplied decisions). Rows created
--     through POST /api/precedents recorded their source as 'typed:<organization uuid>:<user>' in imported_from; those are
--     backfilled from it, and nothing else is guessed.
--   * is_public defaults to FALSE (it defaulted to true, so every new row was published to every organization). Existing rows keep
--     the value they hold; a missing value is not public.
--   * access_restrictions and imported_from are added when absent.
--
-- This does not widen the rest of the stub to the full Drizzle shape: that is a separate schema-parity change. Idempotent.
-- Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION. RLS is cache 0041.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.arbitration_decisions') IS NULL THEN
    RAISE EXCEPTION 'arbitration decision owner fail-closed: public.arbitration_decisions does not exist.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'arbitration decision owner fail-closed: public.organizations does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ADD COLUMN IF NOT EXISTS source_organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ALTER COLUMN is_public SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ADD COLUMN IF NOT EXISTS access_restrictions text;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ADD COLUMN IF NOT EXISTS imported_from varchar(200);
--> statement-breakpoint
UPDATE public.arbitration_decisions
SET source_organization_id = substring(imported_from from '^typed:([0-9a-fA-F-]{36}):')::uuid
WHERE source_organization_id IS NULL
  AND imported_from ~ '^typed:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:'
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = substring(imported_from from '^typed:([0-9a-fA-F-]{36}):')::uuid);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS arbitration_decisions_source_org_idx ON public.arbitration_decisions (source_organization_id);
