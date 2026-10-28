-- 0030_precedent_explicit_share_select
--
-- Multi-party read policy for arbitration_precedents. 0012 gave the table one owner-only policy per command, keyed on
-- source_organization_id, so a precedent another organization shared (an explicit grant, or sharing_level = 'public') was
-- invisible to the grantee even though the sharing columns say it should be readable. Cross-organization sharing therefore
-- failed closed. This adds ONE additional permissive SELECT policy for the runtime role and nothing else:
--
--   * explicit grant: the caller's organization id is in shared_with_org_ids (revoking the grant removes access at once);
--   * public: sharing_level = 'public'.
--
-- Not changed: INSERT, UPDATE and DELETE stay owner-only, so reading a shared precedent never implies writing it. The
-- federation and congress levels are NOT admitted here: they depend on the organization hierarchy and the congress
-- membership table, and deciding them inside a row-level policy needs its own reviewed design. They stay owner-only at the
-- database, and the route's canReadSharedClause still decides what a non-owner may see of a row the policy admits (the
-- owner's document location, grant list and author are withheld; anonymized parties are not disclosed).
--
-- The comparison is on text so a missing or malformed app.current_org_id can never raise or match.

DO $$
BEGIN
  IF to_regclass('public.arbitration_precedents') IS NULL THEN
    RAISE EXCEPTION 'RLS 0030 fail-closed: public.arbitration_precedents does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'arbitration_precedents'
      AND column_name = 'shared_with_org_ids' AND udt_name = '_uuid'
  ) THEN
    RAISE EXCEPTION 'RLS 0030 fail-closed: arbitration_precedents.shared_with_org_ids is not uuid[].';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'arbitration_precedents' AND policyname = 'ue_org_isolation_select'
  ) THEN
    RAISE EXCEPTION 'RLS 0030 fail-closed: the owner policy (0012) is not installed.';
  END IF;
  IF to_regrole('union_eyes_runtime') IS NULL THEN
    RAISE EXCEPTION 'RLS 0030 fail-closed: role union_eyes_runtime does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_precedent_shared_select ON public.arbitration_precedents;
--> statement-breakpoint
CREATE POLICY ue_precedent_shared_select ON public.arbitration_precedents
  FOR SELECT TO union_eyes_runtime
  USING (
    sharing_level = 'public'
    OR (
      shared_with_org_ids IS NOT NULL
      AND current_setting('app.current_org_id', true) = ANY (shared_with_org_ids::text[])
    )
  );
