-- 0049_scim_provisioning_functions
--
-- A SCIM stream is a machine caller: it authenticates with the organization's bearer token and has no signed-in user. The two connections the
-- application has do not fit it. The tenant role (union_eyes_runtime) is only reachable through a session user, so provisioning that asked for it
-- failed before it reached the database; the system role (union_eyes_system) can read and update organization_members but holds no INSERT on it
-- (storage-authority manifest: requiredSystemPrivileges SELECT, UPDATE), so it could not create the membership either. Widening the system role
-- to insert members into any organization would trade that for a far larger authority than SCIM needs.
--
-- These functions are the whole of what a SCIM configuration may do to the membership table, and the database enforces the envelope whatever the
-- caller passes:
--
--   ue_scim_provision_member(configuration, organization, userName, externalId, name, e-mail)
--       creates a PENDING member with role member, keyed scim:<organization>:<lower-cased userName>, or provisions a removed one again as pending. It
--       takes no role and no status, so a caller cannot ask for more; a person is never made active by being named. The identity provider's own
--       subject (externalId) is kept with the row and may identify only one live person of the organization.
--   ue_scim_member_total / ue_scim_list_members
--       the live members of the configuration's own organization, one bounded page at a time, and nothing else.
--
-- Every function first proves that the configuration belongs to the organization named and is live (enabled, not revoked, not past its expiry,
-- and for provisioning with user sync switched on), so naming another organization is refused by the database, not only by the route. They are
-- SECURITY DEFINER because the callers hold no INSERT on the table, STABLE where they only read, pin their search_path, take no table name or SQL
-- from the caller, and are executable by the system role only.
--
-- organization_members carries no unique index on (organization_id, user_id) in the activated schema (the Drizzle declaration is not applied), so
-- uniqueness is enforced here: provisioning of one person is serialized with an advisory lock and a live row is reported as already existing.
-- The key shape means a userName can never name an existing platform user, and a provisioned member is not linked to anyone's account: linking
-- needs a verified provider binding from the platform authentication layer and the organization's declared identity-provider tenant, neither of
-- which exists yet, so it is a recorded blocked operation (lib/scim/provisioned-members.ts) and not something this migration invents.

--   ue_scim_find_member / ue_scim_get_member
--       one provisioned person, by userName or externalId (the two filters an identity provider uses to ask whether a person already exists) or
--       by id.
--   ue_scim_update_member
--       the identity provider's own attributes of a provisioned person (name, e-mail, externalId), and the restoration of a person this same
--       stream deprovisioned. It restores nothing that the organization itself suspended.
--   ue_scim_deprovision_member
--       what the organization's own configured deprovision action (suspend, archive or delete) does to a provisioned person, and nothing else:
--       suspend sets the membership suspended, archive sets it inactive, delete soft-deletes it and sets it revoked. No row is ever removed, no
--       other column of the member is changed, and an unrecognized configured action suspends rather than destroys.
--
-- SCIM sees and changes only the people it provisioned: rows keyed scim:<organization>:<userName>. A person who was invited or who signed in has a
-- platform account id as the key and is not reachable from here, whatever id the caller passes, so a deprovision can never remove the access of a
-- person whose account exists. Listing is confined to the same rows (it used to return the whole roster of the organization, including people the
-- stream has no business with). What a deprovision should mean for a person who is linked to an account is an institutional decision that is
-- still open (UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY); until linking exists no such person is reachable.

DO $$
BEGIN
  IF to_regclass('public.organization_members') IS NULL OR to_regclass('public.scim_configurations') IS NULL THEN
    RAISE EXCEPTION 'RLS 0049 fail-closed: organization_members or scim_configurations does not exist.';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0049 fail-closed: the system role does not exist.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ue_scim_configuration_live(p_configuration_id uuid, p_organization_id uuid, p_requires_user_sync boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.scim_configurations c
     WHERE c.id = p_configuration_id
       AND c.organization_id = p_organization_id
       AND c.enabled
       AND c.revoked_at IS NULL
       AND (c.token_expires_at IS NULL OR c.token_expires_at > now())
       AND (NOT COALESCE(p_requires_user_sync, false) OR c.sync_users)
  )
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_provision_member(
  p_configuration_id uuid,
  p_organization_id uuid,
  p_user_name text,
  p_external_id text,
  p_name text,
  p_email text
)
RETURNS TABLE (
  o_outcome text,
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user_name text := btrim(COALESCE(p_user_name, ''));
  v_external  text := NULLIF(btrim(COALESCE(p_external_id, '')), '');
  v_name      text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_email     text := NULLIF(btrim(COALESCE(p_email, '')), '');
  v_key       text;
  v_scim      jsonb;
  v_now       text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_member    public.organization_members%ROWTYPE;
  v_outcome   text;
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, true) THEN
    RAISE EXCEPTION 'SCIM user provisioning is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  IF v_user_name = '' OR length(v_user_name) > 320 OR (v_external IS NOT NULL AND length(v_external) > 255) THEN
    RAISE EXCEPTION 'A SCIM userName of 1 to 320 characters is required, and an externalId at most 255' USING ERRCODE = '22023';
  END IF;

  v_key := 'scim:' || p_organization_id::text || ':' || lower(v_user_name);
  v_scim := jsonb_strip_nulls(jsonb_build_object(
    'configurationId', p_configuration_id,
    'userName', v_user_name,
    'externalId', v_external,
    'provisionedAt', v_now,
    'link', 'unlinked'
  ));

  -- Provisioning of one person takes turns, so two requests cannot both pass the checks below.
  PERFORM pg_advisory_xact_lock(hashtextextended('scim-provision:' || v_key, 0));

  IF v_external IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.organization_members m
     WHERE m.organization_id = p_organization_id
       AND m.deleted_at IS NULL
       AND m.user_id <> v_key
       AND m.metadata #>> '{scim,externalId}' = v_external
  ) THEN
    RETURN QUERY SELECT 'external_id_conflict'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;

  SELECT m.* INTO v_member
    FROM public.organization_members m
   WHERE m.organization_id = p_organization_id AND m.user_id = v_key
   ORDER BY (m.deleted_at IS NULL) DESC, m.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF v_member.deleted_at IS NULL THEN
      v_outcome := 'exists';
    ELSE
      -- A removed member named again by the identity provider is provisioned again as a pending member, not refused as an existing user.
      UPDATE public.organization_members m
         SET deleted_at = NULL,
             status = 'pending',
             role = 'member',
             name = COALESCE(v_name, m.name),
             email = COALESCE(v_email, m.email),
             metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object('scim', v_scim || jsonb_build_object('reprovisionedAt', v_now)),
             updated_at = now()
       WHERE m.id = v_member.id
      RETURNING m.* INTO v_member;
      v_outcome := 'reprovisioned';
    END IF;
  ELSE
    INSERT INTO public.organization_members (id, organization_id, user_id, name, email, role, status, is_primary, joined_at, metadata, created_at, updated_at)
    VALUES (gen_random_uuid(), p_organization_id, v_key, COALESCE(v_name, v_user_name), COALESCE(v_email, v_user_name), 'member', 'pending', false, NULL,
            jsonb_build_object('scim', v_scim), now(), now())
    RETURNING * INTO v_member;
    v_outcome := 'created';
  END IF;

  RETURN QUERY SELECT v_outcome, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                      v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_member_total(p_configuration_id uuid, p_organization_id uuid)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, false) THEN
    RAISE EXCEPTION 'SCIM is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT count(*) FROM public.organization_members m
     WHERE m.organization_id = p_organization_id AND m.deleted_at IS NULL AND starts_with(m.user_id, 'scim:' || p_organization_id::text || ':')
  );
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_list_members(p_configuration_id uuid, p_organization_id uuid, p_offset integer, p_limit integer)
RETURNS TABLE (
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, false) THEN
    RAISE EXCEPTION 'SCIM is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.user_id, m.name, m.email, m.status, m.joined_at, m.created_at, m.updated_at, m.metadata
      FROM public.organization_members m
     WHERE m.organization_id = p_organization_id AND m.deleted_at IS NULL AND starts_with(m.user_id, 'scim:' || p_organization_id::text || ':')
     ORDER BY m.created_at ASC, m.id ASC
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 0), 0), 100);
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_find_member(p_configuration_id uuid, p_organization_id uuid, p_attribute text, p_value text)
RETURNS TABLE (
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_prefix text := 'scim:' || p_organization_id::text || ':';
  v_value  text := btrim(COALESCE(p_value, ''));
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, false) THEN
    RAISE EXCEPTION 'SCIM is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  IF p_attribute IS NULL OR p_attribute NOT IN ('userName', 'externalId') THEN
    RAISE EXCEPTION 'Only userName and externalId can be filtered on' USING ERRCODE = '22023';
  END IF;
  IF v_value = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.id, m.user_id, m.name, m.email, m.status, m.joined_at, m.created_at, m.updated_at, m.metadata
      FROM public.organization_members m
     WHERE m.organization_id = p_organization_id AND m.deleted_at IS NULL AND starts_with(m.user_id, v_prefix)
       AND CASE WHEN p_attribute = 'userName' THEN m.user_id = v_prefix || lower(v_value)
                ELSE m.metadata #>> '{scim,externalId}' = v_value END
     ORDER BY m.created_at ASC, m.id ASC
     LIMIT 100;
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_get_member(p_configuration_id uuid, p_organization_id uuid, p_member_id uuid)
RETURNS TABLE (
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, false) THEN
    RAISE EXCEPTION 'SCIM is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.user_id, m.name, m.email, m.status, m.joined_at, m.created_at, m.updated_at, m.metadata
      FROM public.organization_members m
     WHERE m.id = p_member_id AND m.organization_id = p_organization_id AND m.deleted_at IS NULL
       AND starts_with(m.user_id, 'scim:' || p_organization_id::text || ':');
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_update_member(
  p_configuration_id uuid,
  p_organization_id uuid,
  p_member_id uuid,
  p_name text,
  p_email text,
  p_external_id text,
  p_clear_external_id boolean,
  p_reactivate boolean
)
RETURNS TABLE (
  o_outcome text,
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_prefix   text := 'scim:' || p_organization_id::text || ':';
  v_name     text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_email    text := NULLIF(btrim(COALESCE(p_email, '')), '');
  v_external text := NULLIF(btrim(COALESCE(p_external_id, '')), '');
  v_now      text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_member   public.organization_members%ROWTYPE;
  v_scim     jsonb;
  v_status   text;
  v_changed  boolean := false;
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, true) THEN
    RAISE EXCEPTION 'SCIM user provisioning is not enabled for this organization' USING ERRCODE = '42501';
  END IF;
  IF v_external IS NOT NULL AND length(v_external) > 255 THEN
    RAISE EXCEPTION 'An externalId of at most 255 characters is required' USING ERRCODE = '22023';
  END IF;

  -- Changes to one person take turns, so a restoration and a deprovision cannot both pass the checks below.
  PERFORM pg_advisory_xact_lock(hashtextextended('scim-member:' || p_member_id::text, 0));

  SELECT m.* INTO v_member
    FROM public.organization_members m
   WHERE m.id = p_member_id AND m.organization_id = p_organization_id AND m.deleted_at IS NULL AND starts_with(m.user_id, v_prefix)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;

  v_scim := COALESCE(v_member.metadata -> 'scim', '{}'::jsonb);
  v_status := v_member.status;

  IF v_external IS NOT NULL AND v_external IS DISTINCT FROM (v_scim ->> 'externalId') THEN
    IF EXISTS (
      SELECT 1 FROM public.organization_members o
       WHERE o.organization_id = p_organization_id AND o.deleted_at IS NULL AND o.id <> v_member.id
         AND o.metadata #>> '{scim,externalId}' = v_external
    ) THEN
      RETURN QUERY SELECT 'external_id_conflict'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text,
                          NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
      RETURN;
    END IF;
    v_scim := v_scim || jsonb_build_object('externalId', v_external);
    v_changed := true;
  ELSIF COALESCE(p_clear_external_id, false) AND (v_scim -> 'externalId') IS NOT NULL THEN
    v_scim := v_scim - 'externalId';
    v_changed := true;
  END IF;

  IF COALESCE(p_reactivate, false) AND v_member.status IN ('suspended', 'inactive') THEN
    -- Only a deprovision this stream made is undone by it. A membership the organization itself suspended or set inactive stays as it is, and
    -- nothing is written when that is the case.
    IF (v_scim #>> '{deprovisioned,by}') IS DISTINCT FROM 'scim' THEN
      RETURN QUERY SELECT 'held'::text, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                          v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
      RETURN;
    END IF;
    v_scim := (v_scim - 'deprovisioned') || jsonb_build_object('reactivatedAt', v_now);
    v_status := 'pending';
    v_changed := true;
  END IF;

  IF v_name IS NOT NULL AND v_name IS DISTINCT FROM v_member.name THEN v_changed := true; ELSE v_name := NULL; END IF;
  IF v_email IS NOT NULL AND v_email IS DISTINCT FROM v_member.email THEN v_changed := true; ELSE v_email := NULL; END IF;

  IF NOT v_changed THEN
    RETURN QUERY SELECT 'unchanged'::text, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                        v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
    RETURN;
  END IF;

  UPDATE public.organization_members m
     SET name = COALESCE(v_name, m.name),
         email = COALESCE(v_email, m.email),
         status = v_status,
         metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object('scim', v_scim),
         updated_at = now()
   WHERE m.id = v_member.id
  RETURNING m.* INTO v_member;

  RETURN QUERY SELECT 'updated'::text, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                      v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
END
$$;

CREATE OR REPLACE FUNCTION public.ue_scim_deprovision_member(p_configuration_id uuid, p_organization_id uuid, p_member_id uuid, p_via text)
RETURNS TABLE (
  o_outcome text,
  o_action text,
  o_id uuid,
  o_user_id text,
  o_name text,
  o_email text,
  o_status text,
  o_joined_at timestamptz,
  o_created_at timestamptz,
  o_updated_at timestamptz,
  o_metadata jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_prefix     text := 'scim:' || p_organization_id::text || ':';
  v_now        text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_via        text := CASE WHEN p_via IN ('patch', 'put', 'delete') THEN p_via ELSE 'patch' END;
  v_configured text;
  v_action     text;
  v_status     text;
  v_member     public.organization_members%ROWTYPE;
BEGIN
  IF NOT public.ue_scim_configuration_live(p_configuration_id, p_organization_id, true) THEN
    RAISE EXCEPTION 'SCIM user provisioning is not enabled for this organization' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('scim-member:' || p_member_id::text, 0));

  SELECT m.* INTO v_member
    FROM public.organization_members m
   WHERE m.id = p_member_id AND m.organization_id = p_organization_id AND m.deleted_at IS NULL AND starts_with(m.user_id, v_prefix)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text,
                        NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, NULL::jsonb;
    RETURN;
  END IF;

  -- The organization chose what a deprovision does; a value this function does not know suspends (reversible) and never destroys.
  SELECT c.deprovision_action INTO v_configured FROM public.scim_configurations c WHERE c.id = p_configuration_id;
  v_action := CASE WHEN v_configured IN ('suspend', 'archive', 'delete') THEN v_configured ELSE 'suspend' END;

  IF v_member.status IN ('suspended', 'inactive', 'revoked') THEN
    RETURN QUERY SELECT 'unchanged'::text, v_action, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                        v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
    RETURN;
  END IF;

  v_status := CASE v_action WHEN 'suspend' THEN 'suspended' WHEN 'archive' THEN 'inactive' ELSE 'revoked' END;
  UPDATE public.organization_members m
     SET status = v_status,
         deleted_at = CASE WHEN v_action = 'delete' THEN now() ELSE m.deleted_at END,
         metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object('scim',
           COALESCE(m.metadata -> 'scim', '{}'::jsonb) || jsonb_build_object('deprovisioned', jsonb_build_object(
             'at', v_now, 'action', v_action, 'from', v_member.status, 'by', 'scim', 'via', v_via, 'configurationId', p_configuration_id))),
         updated_at = now()
   WHERE m.id = v_member.id
  RETURNING m.* INTO v_member;

  RETURN QUERY SELECT 'deprovisioned'::text, v_action, v_member.id, v_member.user_id, v_member.name, v_member.email, v_member.status,
                      v_member.joined_at, v_member.created_at, v_member.updated_at, v_member.metadata;
END
$$;

REVOKE ALL ON FUNCTION public.ue_scim_configuration_live(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_provision_member(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_member_total(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_list_members(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_find_member(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_get_member(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_update_member(uuid, uuid, uuid, text, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ue_scim_deprovision_member(uuid, uuid, uuid, text) FROM PUBLIC;

-- The configuration check is internal: the three operations call it as their owner.
GRANT EXECUTE ON FUNCTION public.ue_scim_provision_member(uuid, uuid, text, text, text, text) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_member_total(uuid, uuid) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_list_members(uuid, uuid, integer, integer) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_find_member(uuid, uuid, text, text) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_get_member(uuid, uuid, uuid) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_update_member(uuid, uuid, uuid, text, text, text, boolean, boolean) TO union_eyes_system;
GRANT EXECUTE ON FUNCTION public.ue_scim_deprovision_member(uuid, uuid, uuid, text) TO union_eyes_system;
