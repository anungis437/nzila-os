-- 0036_contact_submissions_rls_closure
--
-- contact_submissions (platform 0045) holds anonymous visitors' contact details. It is not tenant data and no tenant session may
-- read or write it: FORCE RLS with a single system-role policy and no runtime policy, the reviewed SYSTEM_ONLY shape used for the
-- ICRA tables in 0016. This migration does not grant DML; exact privileges come from the storage-authority manifest
-- (db/rls-storage-authority/communications-notifications.ts).

DO $$
BEGIN
  IF to_regclass('public.contact_submissions') IS NULL THEN
    RAISE EXCEPTION 'RLS 0036 fail-closed: public.contact_submissions does not exist (platform 0045 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0036 fail-closed: role union_eyes_system does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.contact_submissions;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.contact_submissions FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);