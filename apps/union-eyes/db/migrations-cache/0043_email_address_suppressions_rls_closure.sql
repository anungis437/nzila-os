-- 0043_email_address_suppressions_rls_closure
--
-- email_address_suppressions (platform 0053) is a platform-wide list, not tenant data: FORCE RLS with a single system-role policy and no
-- runtime policy, the reviewed SYSTEM_ONLY shape (see 0036). The webhook and the sending function read and write it under the system
-- role; no tenant session can read or change it. This migration does not grant DML: exact privileges come from the storage-authority
-- manifest (db/rls-storage-authority/communications-notifications.ts).

DO $$
BEGIN
  IF to_regclass('public.email_address_suppressions') IS NULL THEN
    RAISE EXCEPTION 'RLS 0043 fail-closed: public.email_address_suppressions does not exist (platform 0053 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0043 fail-closed: role union_eyes_system does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.email_address_suppressions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.email_address_suppressions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.email_address_suppressions;
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.email_address_suppressions FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);