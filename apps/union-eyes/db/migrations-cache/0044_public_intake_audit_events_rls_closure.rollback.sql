-- 0044_public_intake_audit_events_rls_closure rollback: removes the policies and row security.
DO $$ BEGIN
  IF to_regclass('public.public_intake_audit_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_system_select ON public.public_intake_audit_events;
    DROP POLICY IF EXISTS ue_system_insert ON public.public_intake_audit_events;
    ALTER TABLE public.public_intake_audit_events NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.public_intake_audit_events DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
