-- 0041_arbitration_decisions_owner_rls rollback: removes the policies and row security, which returns the table to the unrestricted
-- state it had before. Run only knowingly: every organization can again read and write every decision.
DO $$ BEGIN
  IF to_regclass('public.arbitration_decisions') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_decision_public_select ON public.arbitration_decisions;
    DROP POLICY IF EXISTS ue_decision_owner_select ON public.arbitration_decisions;
    DROP POLICY IF EXISTS ue_decision_owner_insert ON public.arbitration_decisions;
    DROP POLICY IF EXISTS ue_decision_owner_update ON public.arbitration_decisions;
    DROP POLICY IF EXISTS ue_decision_owner_delete ON public.arbitration_decisions;
    DROP POLICY IF EXISTS ue_system_full_access ON public.arbitration_decisions;
    ALTER TABLE public.arbitration_decisions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.arbitration_decisions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
