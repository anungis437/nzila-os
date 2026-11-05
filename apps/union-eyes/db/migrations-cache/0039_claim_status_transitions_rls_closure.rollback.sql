-- 0039_claim_status_transitions_rls_closure rollback: removes the policies and row security. Run only with the status-change triggers
-- of platform 0049 removed or the table dropped, because the trigger insert needs the policy set below to be absent or satisfied.
DO $$ BEGIN
  IF to_regclass('public.claim_status_transitions') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_system_full_access ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_system_select ON public.claim_status_transitions;
    DROP POLICY IF EXISTS ue_transition_trigger_insert ON public.claim_status_transitions;
    ALTER TABLE public.claim_status_transitions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.claim_status_transitions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
