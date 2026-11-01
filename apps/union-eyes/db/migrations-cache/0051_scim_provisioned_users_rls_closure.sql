-- 0051_scim_provisioned_users_rls_closure
--
-- Cache 0049 gave the SCIM stream eight SECURITY DEFINER functions to write the membership table, because the system role holds no INSERT on it.
-- The catalog admission contract refuses any SECURITY DEFINER function that the tenant or system role can execute, and a role that can insert
-- members into any organization is the wrong trade, so the people an identity provider provisions are no longer roster rows: they are the
-- directory of platform 0059 (scim_provisioned_users), which only the system role reaches. This migration retires the functions and closes the two
-- SCIM relations the way the other system-only relations are closed:
--
--   * scim_provisioned_users: FORCE RLS, no tenant policy, system policies for SELECT, INSERT and UPDATE. There is no DELETE: a deprovision is a state
--     change on the row, and a removal would erase the evidence of who was provisioned.
--   * scim_events_log: FORCE RLS, no tenant policy, system policies for SELECT and INSERT only, so an event can be recorded and read and never changed.
--
-- This migration does not grant DML: exact privileges come from the storage-authority manifest (db/rls-storage-authority/reference-latent.ts).
-- Retiring the functions is one-way by design: they never belonged to an admitted schema, and restoring them would make the privilege preflight fail.
-- A relation that is absent is not touched, a function that is absent is skipped, and the policies are replaced in place, so this is idempotent.

DO $$
BEGIN
  IF to_regclass('public.scim_provisioned_users') IS NULL OR to_regclass('public.scim_events_log') IS NULL THEN
    RAISE EXCEPTION 'RLS 0051 fail-closed: scim_provisioned_users or scim_events_log does not exist (platform 0059 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0051 fail-closed: role union_eyes_system does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_deprovision_member(uuid, uuid, uuid, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_update_member(uuid, uuid, uuid, text, text, text, boolean, boolean);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_get_member(uuid, uuid, uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_find_member(uuid, uuid, text, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_list_members(uuid, uuid, integer, integer);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_member_total(uuid, uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_provision_member(uuid, uuid, text, text, text, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_scim_configuration_live(uuid, uuid, boolean);
--> statement-breakpoint
ALTER TABLE public.scim_provisioned_users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.scim_provisioned_users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.scim_provisioned_users;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.scim_provisioned_users FOR SELECT TO union_eyes_system USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_insert ON public.scim_provisioned_users;
--> statement-breakpoint
CREATE POLICY ue_system_insert ON public.scim_provisioned_users FOR INSERT TO union_eyes_system WITH CHECK (true);
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_update ON public.scim_provisioned_users;
--> statement-breakpoint
CREATE POLICY ue_system_update ON public.scim_provisioned_users FOR UPDATE TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE public.scim_events_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.scim_events_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.scim_events_log;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.scim_events_log FOR SELECT TO union_eyes_system USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_insert ON public.scim_events_log;
--> statement-breakpoint
CREATE POLICY ue_system_insert ON public.scim_events_log FOR INSERT TO union_eyes_system WITH CHECK (true);
