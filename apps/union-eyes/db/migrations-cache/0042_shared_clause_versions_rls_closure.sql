-- 0042_shared_clause_versions_rls_closure
--
-- FORCE RLS for shared_clause_versions (platform 0052): a direct organization_id tenant table, using ue_create_direct_org_rls_policy
-- from 0010, then narrowed to an append-only record. The runtime role reads and inserts its own organization's history and cannot change
-- or remove a row (the manifest, db/rls-storage-authority/reference-latent.ts, grants SELECT and INSERT only); the system role reads.
-- The update and delete policies 0010 installs are removed, so even a privilege granted by mistake could not change a version.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0042 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.shared_clause_versions') IS NULL THEN
    RAISE EXCEPTION 'RLS 0042 fail-closed: public.shared_clause_versions does not exist (platform 0052 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.shared_clause_versions'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0042 fail-closed: public.shared_clause_versions is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('shared_clause_versions');
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_update ON public.shared_clause_versions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_delete ON public.shared_clause_versions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.shared_clause_versions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.shared_clause_versions;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.shared_clause_versions FOR SELECT TO union_eyes_system USING (true);
