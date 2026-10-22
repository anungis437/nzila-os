/**
 * Governed UE companion to the canonical auth bootstrap. This does not execute
 * on import. Apply only through the qualified migration controller.
 *
 * Reactivation must commit the auth and business membership together. The auth
 * system executor therefore receives only the business columns it needs, with
 * the same actor/target/organization/reason context as its auth membership write.
 */
export function compileMemberAccessProjectionSql(): string {
  const scope = `user_id = NULLIF(current_setting('nzila.auth_user_id',true),'')
    AND organization_id::text = NULLIF(current_setting('nzila.auth_org_id',true),'')
    AND NULLIF(current_setting('nzila.auth_phase',true),'') = 'system'
    AND NULLIF(current_setting('nzila.auth_operation',true),'') = 'membership-state'
    AND NULLIF(current_setting('nzila.auth_actor_id',true),'') IS NOT NULL
    AND NULLIF(current_setting('nzila.auth_reason',true),'') IS NOT NULL`;
  return `DO $ue_auth$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='nzila_auth_system_mutation'
      AND NOT (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN
      RAISE EXCEPTION 'Canonical non-login auth system role required';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_class WHERE oid='public.organization_members'::regclass
      AND relrowsecurity AND relforcerowsecurity
      AND relowner<>(SELECT oid FROM pg_roles WHERE rolname='nzila_auth_system_mutation')) THEN
      RAISE EXCEPTION 'Forced RLS and separate membership ownership required';
    END IF;
    IF pg_has_role('union_eyes_runtime','nzila_auth_system_mutation','MEMBER')
      OR pg_has_role('union_eyes_system','nzila_auth_system_mutation','MEMBER') THEN
      RAISE EXCEPTION 'Business principals must not inherit auth system authority';
    END IF;
    IF has_any_column_privilege('nzila_auth_system_mutation','public.organization_members','SELECT')
      OR has_any_column_privilege('nzila_auth_system_mutation','public.organization_members','UPDATE')
      OR has_table_privilege('nzila_auth_system_mutation','public.organization_members','INSERT,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename='organization_members'
        AND policyname IN ('ue_auth_member_projection_select','ue_auth_member_projection_reactivate')) THEN
      RAISE EXCEPTION 'Existing membership projection authority requires explicit reconciliation';
    END IF;
  END $ue_auth$;
  GRANT USAGE ON SCHEMA public TO nzila_auth_system_mutation;
  GRANT SELECT (id,user_id,organization_id,status), UPDATE (status,updated_at)
    ON public.organization_members TO nzila_auth_system_mutation;
  CREATE POLICY ue_auth_member_projection_select ON public.organization_members
    FOR SELECT TO nzila_auth_system_mutation USING (${scope});
  CREATE POLICY ue_auth_member_projection_reactivate ON public.organization_members
    FOR UPDATE TO nzila_auth_system_mutation USING (${scope})
    WITH CHECK (${scope} AND status='active');`;
}
