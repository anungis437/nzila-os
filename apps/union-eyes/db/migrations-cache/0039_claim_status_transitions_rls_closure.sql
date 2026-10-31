-- 0039_claim_status_transitions_rls_closure
--
-- FORCE RLS for claim_status_transitions (platform 0049): a direct organization_id tenant table, using ue_create_direct_org_rls_policy
-- from 0010, then narrowed to an append-only record. The application roles read the organization's own transitions and nothing else:
-- the manifest (db/rls-storage-authority/claims-continuity.ts) grants them SELECT only, and the insert policy 0010 installs is
-- replaced by one that admits an insert only from a role that is neither application role (the SECURITY DEFINER trigger function of
-- 0049, which runs as the table owner), so a transition can be written only by the status change itself. The update and delete
-- policies 0010 installs are removed: no application role may change or remove a transition.

DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'RLS 0039 fail-closed: ue_create_direct_org_rls_policy() is not installed (0010 not applied).';
  END IF;
  IF to_regclass('public.claim_status_transitions') IS NULL THEN
    RAISE EXCEPTION 'RLS 0039 fail-closed: public.claim_status_transitions does not exist (platform 0049 not applied).';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.claim_status_transitions'::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
  ) THEN
    RAISE EXCEPTION 'RLS 0039 fail-closed: public.claim_status_transitions is owned by a runtime role.';
  END IF;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('claim_status_transitions');
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_insert ON public.claim_status_transitions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_update ON public.claim_status_transitions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_org_isolation_delete ON public.claim_status_transitions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.claim_status_transitions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.claim_status_transitions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_transition_trigger_insert ON public.claim_status_transitions;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.claim_status_transitions FOR SELECT TO union_eyes_system USING (true);
--> statement-breakpoint
CREATE POLICY ue_transition_trigger_insert ON public.claim_status_transitions FOR INSERT TO PUBLIC
  WITH CHECK (current_user NOT IN ('union_eyes_runtime', 'union_eyes_system'));
