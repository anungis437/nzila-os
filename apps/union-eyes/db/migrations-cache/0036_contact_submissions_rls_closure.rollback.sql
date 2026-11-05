-- 0036 rollback: removes the policy and row security. Only with the contact route disabled.
DROP POLICY IF EXISTS ue_system_full_access ON public.contact_submissions;
ALTER TABLE IF EXISTS public.contact_submissions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contact_submissions DISABLE ROW LEVEL SECURITY;
