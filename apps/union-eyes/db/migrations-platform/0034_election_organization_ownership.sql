-- PLATFORM_SQL 0034_election_organization_ownership
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- council_elections has no organization column. This relation names the one organization
-- that may see or supersede that election. A lookup joins it and filters organization_id.
-- A missing election and an election owned by another organization are both absent.
-- This migration does not rewrite a certified column, does not drop a relation,
-- and does not issue an authority grant.

DO $$
BEGIN
  IF to_regclass('public.council_elections') IS NULL THEN
    RAISE EXCEPTION 'platform 0034 fail-closed: council_elections does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.election_organization_ownership (
  election_id uuid PRIMARY KEY REFERENCES public.council_elections (id),
  organization_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS election_organization_ownership_org_idx
  ON public.election_organization_ownership (organization_id);
