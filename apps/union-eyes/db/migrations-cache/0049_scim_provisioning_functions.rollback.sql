-- Rollback of 0049_scim_provisioning_functions: SCIM provisioning has no database path for a session-less caller again.
DROP FUNCTION IF EXISTS public.ue_scim_deprovision_member(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.ue_scim_update_member(uuid, uuid, uuid, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.ue_scim_get_member(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ue_scim_find_member(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.ue_scim_list_members(uuid, uuid, integer, integer);
DROP FUNCTION IF EXISTS public.ue_scim_member_total(uuid, uuid);
DROP FUNCTION IF EXISTS public.ue_scim_provision_member(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.ue_scim_configuration_live(uuid, uuid, boolean);
