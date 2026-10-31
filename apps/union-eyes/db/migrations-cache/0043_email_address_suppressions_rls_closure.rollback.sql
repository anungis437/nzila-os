-- 0043_email_address_suppressions_rls_closure rollback: removes the policy and row security.
DO $$ BEGIN
  IF to_regclass('public.email_address_suppressions') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_system_full_access ON public.email_address_suppressions;
    ALTER TABLE public.email_address_suppressions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.email_address_suppressions DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;