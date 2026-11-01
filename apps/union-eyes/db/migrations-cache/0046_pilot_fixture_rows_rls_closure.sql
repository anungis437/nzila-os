-- 0046_pilot_fixture_rows_rls_closure
--
-- FORCE RLS for pilot_fixture_rows (platform 0058): a direct organization_id tenant table, using ue_create_direct_org_rls_policy from 0010.
-- The bootstrap reads and writes it as the runtime role bound to the fixture organization, so a reset can see and delete only that
-- organization's ledger rows; the system role creates the organization marker. The ledger is an origin record, not something to be edited:
-- the update policy 0010 installs is removed, and the manifest (db/rls-storage-authority/reference-latent.ts) grants no UPDATE.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0046 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.pilot_fixture_rows') IS NULL THEN
    RAISE EXCEPTION 'RLS 0046 fail-closed: public.pilot_fixture_rows does not exist (platform 0058 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.pilot_fixture_rows'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0046 fail-closed: public.pilot_fixture_rows is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_fixture_rows');
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_update ON public.pilot_fixture_rows;
