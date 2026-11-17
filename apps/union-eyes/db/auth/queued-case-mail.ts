/** Governed mail execution capabilities. No business/system role receives raw canonical identity access. */
import { AUTH_BRIDGE_PURPOSE, AUTH_BRIDGE_PROVIDER_NO_PARENT } from '@nzila/db/auth-storage-authority'
import { ROLE_CAPACITIES } from '../../lib/authority/capacity'
import { ACTIVE_CASE_RESPONDENT_SQL, ACTIVE_RECUSAL_SQL } from '../../lib/authority/common'
import { TENANT_LOCAL_ROLES, getRoleLevel, UserRole } from '../../lib/auth/roles'

export const QUEUED_CASE_MAIL_OWNER = 'nzila_auth_org_authority_reader'
export const QUEUED_CASE_MAIL_OPERATION = 'ue.case-mail.intent/1'
export const QUEUED_CASE_MAIL_MINT = 'public.ue_issue_queued_case_mail'
export const QUEUED_CASE_MAIL_CONTEXT = 'public.ue_queued_case_mail_context'
const roles = (values: readonly string[]) => values.map(value => `'${value.replaceAll("'", "''")}'`).join(',')
const handlerRoles = roles(Object.keys(ROLE_CAPACITIES).filter(role => ROLE_CAPACITIES[role].some(cap => ['steward','chief_steward','officer'].includes(cap))))
const staffRoles = roles(TENANT_LOCAL_ROLES.filter(role => getRoleLevel(role) >= getRoleLevel(UserRole.STEWARD)))
const key = (name: string) => `NULLIF(current_setting('ue.mail_${name}',true),'')`
const clearContext = ['queue','org','actor','case','recipient'].map(name => `PERFORM set_config('ue.mail_${name}','',true);`).join('\n')
const saveContext = ['queue','org','actor','case','recipient'].map(name => `prior_${name} text := current_setting('ue.mail_${name}',true);`).join('\n')
const restoreContext = ['queue','org','actor','case','recipient'].map(name => `PERFORM set_config('ue.mail_${name}',COALESCE(prior_${name},''),true);`).join('\n')
const scope = `organization_id::text=${key('org')}`
const boundPayload = `(q.payload - ARRAY['seal','authorityCapability','mail'])`

// Only the two public entry points can invoke this private loader. They establish its bounded context themselves.
export const QUEUED_CASE_MAIL_LOAD_BODY = `
#variable_conflict use_variable
DECLARE
  actor text := ${key('actor')}; org uuid := ${key('org')}::uuid; case_id uuid;
  member_role text; letter record; c record; s record; claim_row record; grievance_row record; has_claim boolean; has_grievance boolean; adverse jsonb; recipient text; recipient_email text; recipient_locale text; source_hash text;
  checked_at timestamptz := clock_timestamp(); relationships jsonb; mandates jsonb; recusals jsonb; purpose text := task->>'purpose';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||person,0))
    FROM (SELECT DISTINCT person FROM unnest(ARRAY[actor,task->>'recipientId']) person WHERE person IS NOT NULL ORDER BY person) people;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||resource,0))
    FROM (SELECT DISTINCT resource FROM unnest(ARRAY[task->>'caseId',task->>'correspondenceId']) resource WHERE resource IS NOT NULL ORDER BY resource) resources;
  checked_at:=clock_timestamp();
  SELECT m.role INTO member_role FROM user_management.organization_users m
    JOIN user_management.users u ON u.user_id=m.user_id
    WHERE m.user_id=actor AND m.organization_id=org AND m.is_active
      AND u.is_active AND u.lifecycle_state='active';
  IF NOT FOUND OR (SELECT count(*) FROM user_management.organization_users m WHERE m.user_id=actor AND m.organization_id=org)<>1 THEN RETURN NULL; END IF;
  IF purpose='approved_correspondence_email_v1' THEN
    SELECT id,organization_id,grievance_id,status,drafted_by,approved_by,approved_at,assigned_signer_id,
      signed_by,signed_at,signature_id,subject,body,reference_number INTO letter
      FROM public.correspondence WHERE id=(task->>'correspondenceId')::uuid AND organization_id=org;
    IF NOT FOUND OR letter.status<>'signed' OR letter.approved_by IS NULL OR letter.approved_at IS NULL
      OR letter.approved_by=letter.drafted_by OR letter.signed_by IS NULL OR letter.signed_at IS NULL
      OR letter.signature_id IS NULL OR letter.assigned_signer_id IS DISTINCT FROM letter.signed_by
      OR NOT isfinite(letter.approved_at) OR NOT isfinite(letter.signed_at)
      OR letter.approved_at>checked_at OR letter.signed_at>checked_at THEN RETURN NULL; END IF;
    case_id:=letter.grievance_id;
    SELECT encode(sha256(convert_to(jsonb_build_array(to_jsonb(letter),COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb))::text,'UTF8')),'hex')
      INTO source_hash FROM (SELECT id,correspondence_id,name,email,recipient_type,mailing_address,organization,title
        FROM public.correspondence_recipients WHERE correspondence_id=letter.id) r;
    IF case_id IS NULL THEN
      IF member_role NOT IN (${staffRoles}) THEN RETURN NULL; END IF;
      RETURN jsonb_build_object('unlinked',true,'organizationId',org,'userId',actor,'sourceHash',source_hash,'checkedAt',checked_at);
    END IF;
  ELSIF purpose='case_status_notification_v1' THEN
    case_id:=(task->>'caseId')::uuid; recipient:=task->>'recipientId';
  ELSE RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||case_id::text,0));
  PERFORM set_config('ue.mail_case',case_id::text,true);
  SELECT a.id,a.organization_id,a.case_id,a.claim_id,a.grievance_id,a.unit_id,a.territory_id,
    a.grievance_mirror_id,a.mirror_recorded_at,a.mirror_recorded_by,u.organization_id AS unit_org,u.status::text AS unit_status,u.archived_at AS unit_archived,
    t.organization_id AS territory_org,t.retired_at AS territory_retired,t.source_instrument AS territory_instrument
    INTO s FROM public.case_authority_scopes a
    LEFT JOIN public.bargaining_units u ON u.id=a.unit_id LEFT JOIN public.case_territories t ON t.id=a.territory_id
    WHERE a.organization_id=org AND a.case_id=case_id;
  SELECT claim_id,member_id INTO claim_row FROM public.claims WHERE claim_id=case_id AND organization_id=org;
  has_claim:=FOUND;
  SELECT id,represented_member_user_id,has_legal_implications,is_confidential INTO grievance_row
    FROM public.grievances WHERE id=case_id AND organization_id=org;
  has_grievance:=FOUND;
  IF NOT has_claim AND NOT has_grievance THEN RETURN NULL; END IF;
  IF has_claim AND has_grievance THEN
    IF s.id IS NULL OR s.claim_id IS DISTINCT FROM case_id OR s.grievance_id IS NOT NULL
      OR s.grievance_mirror_id IS DISTINCT FROM case_id OR s.mirror_recorded_at IS NULL OR NOT isfinite(s.mirror_recorded_at)
      OR s.mirror_recorded_at>checked_at OR s.mirror_recorded_by IS NULL
      OR grievance_row.represented_member_user_id IS DISTINCT FROM claim_row.member_id THEN RETURN NULL; END IF;
  ELSIF s.id IS NOT NULL AND ((has_claim AND s.claim_id IS DISTINCT FROM case_id) OR (has_grievance AND s.grievance_id IS DISTINCT FROM case_id)) THEN RETURN NULL; END IF;
  IF s.unit_id IS NOT NULL AND s.unit_org IS DISTINCT FROM org THEN RETURN NULL; END IF;
  IF s.territory_id IS NOT NULL AND s.territory_org IS DISTINCT FROM org THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||resource,0))
    FROM (SELECT DISTINCT resource FROM unnest(ARRAY[s.unit_id::text,s.territory_id::text]) resource WHERE resource IS NOT NULL ORDER BY resource) resources;
  SELECT a.id,a.organization_id,a.case_id,a.claim_id,a.grievance_id,a.unit_id,a.territory_id,
    a.grievance_mirror_id,a.mirror_recorded_at,a.mirror_recorded_by,u.organization_id AS unit_org,u.status::text AS unit_status,u.archived_at AS unit_archived,
    t.organization_id AS territory_org,t.retired_at AS territory_retired,t.source_instrument AS territory_instrument
    INTO s FROM public.case_authority_scopes a
    LEFT JOIN public.bargaining_units u ON u.id=a.unit_id LEFT JOIN public.case_territories t ON t.id=a.territory_id
    WHERE a.organization_id=org AND a.case_id=case_id;
  checked_at:=clock_timestamp();
  SELECT COALESCE(jsonb_agg(respondent_user_id),'[]'::jsonb) INTO adverse FROM public.case_respondents
    WHERE organization_id=org AND scope_id=s.id AND ${ACTIVE_CASE_RESPONDENT_SQL.replaceAll('clock_timestamp()', 'checked_at')};
  IF adverse ? actor THEN RETURN NULL; END IF;
  IF has_grievance THEN c:=grievance_row;
  ELSE SELECT false AS has_legal_implications,false AS is_confidential INTO c; END IF;
  IF purpose='case_status_notification_v1' THEN
    IF NOT EXISTS(SELECT FROM public.claims WHERE claim_id=case_id AND organization_id=org
      AND member_id=recipient AND status::text=task->>'newStatus') THEN RETURN NULL; END IF;
    PERFORM set_config('ue.mail_recipient',recipient,true);
    SELECT u.email,u.locale INTO recipient_email,recipient_locale FROM user_management.users u
      JOIN user_management.organization_users m ON m.user_id=u.user_id
      WHERE u.user_id=recipient AND u.is_active AND u.lifecycle_state='active' AND u.email_verified
        AND m.organization_id=org AND m.is_active;
    IF NOT FOUND OR recipient_email IS NULL OR (SELECT count(*) FROM user_management.organization_users m WHERE m.user_id=recipient AND m.organization_id=org)<>1 THEN RETURN NULL; END IF;
    source_hash:=encode(sha256(convert_to(jsonb_build_array(case_id,recipient,task->>'newStatus')::text,'UTF8')),'hex');
  END IF;
  PERFORM id FROM public.ue_authority_resource_relationships WHERE organization_id=org AND principal_user_id=actor
    AND resource_type='case' AND resource_id=case_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO relationships FROM (
    SELECT id,organization_id,principal_user_id,resource_type,resource_id,relation,permissions,privileged_access,origin,
      granted_by,status,effective_at,expires_at,revoked_at FROM public.ue_authority_resource_relationships
      WHERE organization_id=org AND principal_user_id=actor AND resource_type='case' AND resource_id=case_id) r;
  PERFORM id FROM public.ue_authority_mandates WHERE organization_id=org AND principal_user_id=actor AND kind='supervisory';
  SELECT COALESCE(jsonb_agg(to_jsonb(m)),'[]'::jsonb) INTO mandates FROM (
    SELECT m.id,m.organization_id,m.principal_user_id,m.kind,m.powers,m.scope,m.source_instrument,m.granted_by,m.status,
      m.effective_at,m.expires_at,m.revoked_at,m.requires_acceptance,
      (SELECT accepted_at FROM public.ue_authority_acceptances a WHERE a.organization_id=m.organization_id
        AND a.instrument_type='mandate' AND a.instrument_id=m.id AND a.accepted_by=actor) AS accepted_at
      FROM public.ue_authority_mandates m WHERE m.organization_id=org AND m.principal_user_id=actor AND m.kind='supervisory') m;
  SELECT COALESCE(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO recusals FROM (
    SELECT id,organization_id,principal_user_id,resource_type,resource_id,reason,declared_at,lifted_at,lifted_by
      FROM public.ue_authority_recusals WHERE organization_id=org AND principal_user_id=actor
        AND resource_type='case' AND resource_id=case_id) r;
  -- Primary-only disclosure is enforced here as well as by the canonical TypeScript kernel.
  -- A transition may also originate in a specifically granted collaborator relationship or scoped supervisory mandate.
  IF NOT EXISTS(SELECT FROM public.ue_authority_resource_relationships r WHERE r.organization_id=org
      AND r.principal_user_id=actor AND r.resource_type='case' AND r.resource_id=case_id
      AND r.status='active' AND r.revoked_at IS NULL AND isfinite(r.effective_at) AND r.effective_at<=checked_at
      AND (r.expires_at IS NULL OR (isfinite(r.expires_at) AND r.expires_at>checked_at))
      AND member_role IN (${handlerRoles})
      AND (r.relation IN ('owner','assignee') OR (purpose='case_status_notification_v1' AND r.relation='collaborator'
        AND r.origin='explicit' AND r.granted_by IS NOT NULL AND r.granted_by<>actor AND 'transition'=ANY(r.permissions)))
      AND (NOT r.privileged_access OR (r.origin='explicit' AND r.granted_by IS NOT NULL AND r.granted_by<>actor))
      AND (NOT COALESCE(c.has_legal_implications,false) OR r.privileged_access))
    AND NOT (purpose='case_status_notification_v1' AND NOT COALESCE(c.has_legal_implications,false)
      AND EXISTS(SELECT FROM public.ue_authority_mandates m WHERE m.organization_id=org AND m.principal_user_id=actor
        AND m.kind='supervisory' AND m.status='active' AND m.revoked_at IS NULL
        AND m.effective_at<=checked_at AND m.expires_at>checked_at AND 'transition'=ANY(m.powers)
        AND (m.scope->'resourceIds' ? case_id::text OR (s.unit_id IS NOT NULL AND s.unit_status='active' AND s.unit_archived IS NULL AND m.scope->'unitIds' ? s.unit_id::text)
          OR (s.territory_id IS NOT NULL AND s.territory_retired IS NULL AND m.scope->'territoryIds' ? s.territory_id::text)))) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT FROM public.ue_authority_recusals WHERE organization_id=org AND principal_user_id=actor
    AND resource_type='case' AND resource_id=case_id AND ${ACTIVE_RECUSAL_SQL.replaceAll('clock_timestamp()', 'checked_at').replaceAll('statement_timestamp()', 'checked_at')}) THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('organizationId',org,'userId',actor,'caseId',case_id,'membershipRole',member_role,
    'relationships',relationships,'mandates',mandates,'recusals',recusals,'sourceHash',source_hash,'recipientEmail',recipient_email,'recipientLocale',recipient_locale,'checkedAt',checked_at,
    'action',CASE WHEN purpose='case_status_notification_v1' THEN 'case:transition' ELSE 'case:disclose_to_member' END,
    'resource',jsonb_build_object('kind','case','id',case_id,'organizationId',org,
      'unitId',CASE WHEN s.unit_status='active' AND s.unit_archived IS NULL THEN s.unit_id ELSE NULL END,
      'territoryId',CASE WHEN s.territory_retired IS NULL AND length(btrim(s.territory_instrument))>0 THEN s.territory_id ELSE NULL END,
      'classification',CASE WHEN COALESCE(c.has_legal_implications,false) THEN 'privileged' ELSE 'standard' END,
      'confidential',COALESCE(c.is_confidential,false),'counselControlled',false,'adverseUserIds',adverse));
END;
`

export const QUEUED_CASE_MAIL_MINT_BODY = `
DECLARE ${saveContext}
  q record; context jsonb; token text; actor text:=NULLIF(current_setting('app.current_user_id',true),'');
BEGIN
  ${clearContext}
  PERFORM set_config('ue.mail_queue',queue_id::text,true);
  SELECT id,organization_id,payload,created_at,status INTO q FROM public.notification_queue WHERE id=queue_id;
  IF NOT FOUND OR q.status<>'pending' OR q.payload->>'queueId'<>q.id::text OR q.payload->>'organizationId'<>q.organization_id::text
    OR q.payload->>'queuedBy' IS DISTINCT FROM actor OR NOT isfinite(q.created_at) OR q.created_at>clock_timestamp()
    OR NOT user_management.auth_business_org_authorized(q.organization_id,NULL::text[])
    THEN RAISE EXCEPTION 'QUEUED_MAIL_MINT_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM set_config('ue.mail_org',q.organization_id::text,true);
  PERFORM set_config('ue.mail_actor',actor,true);
  context:=public.ue_load_queued_case_mail(q.payload);
  IF context IS NULL OR q.created_at<=clock_timestamp()-interval '23 hours' OR NOT EXISTS (
    SELECT FROM user_management.user_sessions s WHERE s.user_id=actor
      AND s.session_token_hash=encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token',true),''),'UTF8')),'hex')
      AND s.is_active AND isfinite(s.expires_at) AND s.expires_at>(context->>'checkedAt')::timestamptz
      AND (s.organization_id IS NULL OR s.organization_id=q.organization_id)
      AND (s.device_info->>'purpose' IS DISTINCT FROM '${AUTH_BRIDGE_PURPOSE}'
        OR (NULLIF(s.device_info->>'parentSessionId','') IS NOT NULL AND EXISTS (
          SELECT FROM user_management.user_sessions p WHERE p.session_id::text=s.device_info->>'parentSessionId'
            AND p.user_id=s.user_id AND p.is_active AND isfinite(p.expires_at) AND p.expires_at>(context->>'checkedAt')::timestamptz))
        OR (NULLIF(s.device_info->>'parentSessionId','') IS NULL AND s.device_info->>'bridgeClass'='${AUTH_BRIDGE_PROVIDER_NO_PARENT}'))
    ) THEN RAISE EXCEPTION 'QUEUED_MAIL_MINT_DENIED' USING ERRCODE='42501'; END IF;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.ue_authority_requests(organization_id,idempotency_key,operation,request_hash,actor,result)
    VALUES(q.organization_id,queue_id::text,'${QUEUED_CASE_MAIL_OPERATION}',encode(sha256(convert_to(token,'UTF8')),'hex'),actor,
      jsonb_build_object('binding',${boundPayload},'sourceHash',context->>'sourceHash','expiresAt',q.created_at+interval '23 hours'));
  ${restoreContext}
  RETURN jsonb_build_object('capability',token,'context',context);
END;
`

export const QUEUED_CASE_MAIL_CONTEXT_BODY = `
DECLARE ${saveContext}
  q record; authorized record; context jsonb;
BEGIN
  ${clearContext}
  IF capability IS NULL OR capability !~ '^[a-f0-9]{64}$' THEN ${restoreContext} RETURN NULL; END IF;
  PERFORM set_config('ue.mail_queue',queue_id::text,true);
  SELECT id,organization_id,payload,created_at,status INTO q FROM public.notification_queue WHERE id=queue_id;
  IF NOT FOUND OR q.status NOT IN ('pending','retrying','processing') OR NOT isfinite(q.created_at)
    OR q.created_at>clock_timestamp() OR q.created_at<=clock_timestamp()-interval '23 hours' THEN ${restoreContext} RETURN NULL; END IF;
  SELECT organization_id,actor,result INTO authorized FROM public.ue_authority_requests
    WHERE operation='${QUEUED_CASE_MAIL_OPERATION}' AND idempotency_key=queue_id::text
      AND organization_id=q.organization_id AND request_hash=encode(sha256(convert_to(capability,'UTF8')),'hex');
  IF NOT FOUND OR authorized.result->'binding' IS DISTINCT FROM ${boundPayload}
    OR authorized.actor IS DISTINCT FROM q.payload->>'queuedBy' THEN ${restoreContext} RETURN NULL; END IF;
  PERFORM set_config('ue.mail_org',authorized.organization_id::text,true);
  PERFORM set_config('ue.mail_actor',authorized.actor,true);
  context:=public.ue_load_queued_case_mail(q.payload);
  IF context->>'sourceHash' IS DISTINCT FROM authorized.result->>'sourceHash' OR q.created_at<=clock_timestamp()-interval '23 hours' THEN context:=NULL; END IF;
  ${restoreContext}
  RETURN context;
END;
`

export const QUEUED_CASE_MAIL_RESERVED_BODY = `
BEGIN
  IF (TG_OP<>'INSERT' AND OLD.operation='${QUEUED_CASE_MAIL_OPERATION}')
    OR (TG_OP<>'DELETE' AND NEW.operation='${QUEUED_CASE_MAIL_OPERATION}' AND (TG_OP<>'INSERT' OR current_user<>'${QUEUED_CASE_MAIL_OWNER}'))
    THEN RAISE EXCEPTION 'QUEUED_MAIL_CAPABILITY_IMMUTABLE: only the session-bound mint may issue a capability' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
`

export const QUEUED_CASE_MAIL_LOCK_BODY = `
  DECLARE old_value text; new_value text; old_other text; new_other text;
  BEGIN
    IF TG_OP<>'INSERT' THEN old_value:=to_jsonb(OLD)->>TG_ARGV[1]; END IF;
    IF TG_OP<>'DELETE' THEN new_value:=to_jsonb(NEW)->>TG_ARGV[1]; END IF;
    IF TG_NARGS>2 AND TG_OP<>'INSERT' THEN old_other:=to_jsonb(OLD)->>TG_ARGV[2]; END IF;
    IF TG_NARGS>2 AND TG_OP<>'DELETE' THEN new_other:=to_jsonb(NEW)->>TG_ARGV[2]; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.'||TG_ARGV[0]||':'||value,0))
      FROM (SELECT DISTINCT value FROM unnest(ARRAY[old_value,new_value,old_other,new_other]) value WHERE value IS NOT NULL ORDER BY value) values_to_lock;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END; `

/** Additive installation only; any existing function/policy requires catalog reconciliation, never replacement. */
export function compileQueuedCaseMailSql(): string {
  const reader = QUEUED_CASE_MAIL_OWNER
  const scopedAuth = `(user_id=${key('actor')} OR user_id=${key('recipient')})`
  const policies = [
    `CREATE POLICY ue_mail_reader_users ON user_management.users FOR SELECT TO ${reader} USING (${scopedAuth})`,
    `CREATE POLICY ue_mail_reader_memberships ON user_management.organization_users FOR SELECT TO ${reader} USING (${scope} AND ${scopedAuth})`,
    `CREATE POLICY ue_mail_reader_queue ON public.notification_queue FOR SELECT TO ${reader} USING (id::text=${key('queue')})`,
    `CREATE POLICY ue_mail_reader_requests ON public.ue_authority_requests FOR SELECT TO ${reader} USING (operation='${QUEUED_CASE_MAIL_OPERATION}' AND idempotency_key=${key('queue')})`,
    `CREATE POLICY ue_mail_mint_requests ON public.ue_authority_requests FOR INSERT TO ${reader} WITH CHECK (operation='${QUEUED_CASE_MAIL_OPERATION}' AND actor=NULLIF(current_setting('app.current_user_id',true),'') AND user_management.auth_business_org_authorized(organization_id,NULL::text[]))`,
    `CREATE POLICY ue_mail_mint_events ON public.ue_authority_events FOR INSERT TO ${reader} WITH CHECK (${scope} AND source_table='ue_authority_requests' AND row_after->>'operation'='${QUEUED_CASE_MAIL_OPERATION}')`,
    `CREATE POLICY ue_mail_mint_audit ON public.audit_logs FOR SELECT TO ${reader} USING (user_management.auth_business_org_authorized(organization_id,NULL::text[]))`,
    ...['ue_authority_resource_relationships','ue_authority_recusals','ue_authority_mandates'].map(table=>`CREATE POLICY ue_mail_reader_scope ON public.${table} FOR SELECT TO ${reader} USING (${scope} AND principal_user_id=${key('actor')})`),
    `CREATE POLICY ue_mail_reader_scope ON public.ue_authority_acceptances FOR SELECT TO ${reader} USING (${scope} AND accepted_by=${key('actor')})`,
    ...['case_authority_scopes','case_respondents','bargaining_units','case_territories'].map(table=>`CREATE POLICY ue_mail_reader_scope ON public.${table} FOR SELECT TO ${reader} USING (${scope})`),
    `CREATE POLICY ue_mail_reader_scope ON public.claims FOR SELECT TO ${reader} USING (${scope} AND claim_id::text=${key('case')})`,
    `CREATE POLICY ue_mail_reader_scope ON public.grievances FOR SELECT TO ${reader} USING (${scope} AND id::text=${key('case')})`,
    `CREATE POLICY ue_mail_reader_scope ON public.correspondence FOR SELECT TO ${reader} USING (${scope} AND id=(SELECT (payload->>'correspondenceId')::uuid FROM public.notification_queue WHERE id::text=${key('queue')}))`,
    `CREATE POLICY ue_mail_reader_scope ON public.correspondence_recipients FOR SELECT TO ${reader} USING (correspondence_id=(SELECT (payload->>'correspondenceId')::uuid FROM public.notification_queue WHERE id::text=${key('queue')}))`,
  ].join(';\n')+';'
  const fn = (name:string,args:string,body:string) => `CREATE FUNCTION public.${name}(${args}) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $ue_mail$${body}$ue_mail$;
    ALTER FUNCTION public.${name}(${args}) OWNER TO ${reader}; REVOKE ALL ON FUNCTION public.${name}(${args}) FROM PUBLIC,union_eyes_runtime,union_eyes_system;`
  return `DO $ue_mail$ BEGIN
    IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND p.proname IN ('ue_issue_queued_case_mail','ue_queued_case_mail_context','ue_load_queued_case_mail','ue_guard_queued_mail_capability','ue_lock_queued_mail_authority'))
      THEN RAISE EXCEPTION 'Existing queued-mail capability requires explicit reconciliation'; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${reader}' AND NOT(rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole))
      THEN RAISE EXCEPTION 'Existing bounded canonical reader is required'; END IF;
  END $ue_mail$;
  GRANT CREATE ON SCHEMA public TO ${reader};
  GRANT SELECT(user_id,email,email_verified,locale) ON user_management.users TO ${reader};
  GRANT SELECT(id,organization_id,payload,created_at,status) ON public.notification_queue TO ${reader};
  GRANT SELECT(id,organization_id,idempotency_key,operation,request_hash,actor,result,created_at),INSERT(organization_id,idempotency_key,operation,request_hash,actor,result) ON public.ue_authority_requests TO ${reader};
  GRANT INSERT(organization_id,source_table,source_id,operation,actor_user_id,row_before,row_after) ON public.ue_authority_events TO ${reader};
  GRANT SELECT(organization_id,created_at,action,details) ON public.audit_logs TO ${reader};
  DO $ue_mail_sequence$ DECLARE seq text; BEGIN
    SELECT pg_get_serial_sequence('public.ue_authority_events','event_seq') INTO seq;
    IF seq IS NOT NULL THEN EXECUTE format('GRANT USAGE ON SEQUENCE %s TO ${reader}',seq); END IF;
  END $ue_mail_sequence$;
  GRANT SELECT(id,organization_id,principal_user_id,resource_type,resource_id,relation,permissions,privileged_access,origin,granted_by,status,effective_at,expires_at,revoked_at) ON public.ue_authority_resource_relationships TO ${reader};
  GRANT SELECT(id,organization_id,principal_user_id,resource_type,resource_id,reason,declared_at,lifted_at,lifted_by) ON public.ue_authority_recusals TO ${reader};
  GRANT SELECT(id,organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,status,effective_at,expires_at,revoked_at,requires_acceptance) ON public.ue_authority_mandates TO ${reader};
  GRANT SELECT(organization_id,instrument_type,instrument_id,accepted_by,accepted_at) ON public.ue_authority_acceptances TO ${reader};
  GRANT SELECT(claim_id,organization_id,member_id,status) ON public.claims TO ${reader};
  GRANT SELECT(id,organization_id,represented_member_user_id,has_legal_implications,is_confidential) ON public.grievances TO ${reader};
  GRANT SELECT(id,organization_id,case_id,claim_id,grievance_id,unit_id,territory_id,grievance_mirror_id,mirror_recorded_at,mirror_recorded_by) ON public.case_authority_scopes TO ${reader};
  GRANT SELECT(organization_id,scope_id,respondent_user_id,recorded_at,revoked_at,revoked_by,revoked_proposal_id) ON public.case_respondents TO ${reader};
  GRANT SELECT(id,organization_id,status,archived_at) ON public.bargaining_units TO ${reader};
  GRANT SELECT(id,organization_id,retired_at,source_instrument) ON public.case_territories TO ${reader};
  GRANT SELECT(id,organization_id,grievance_id,status,drafted_by,approved_by,approved_at,assigned_signer_id,signed_by,signed_at,signature_id,subject,body,reference_number) ON public.correspondence TO ${reader};
  GRANT SELECT(id,correspondence_id,name,email,recipient_type,mailing_address,organization,title) ON public.correspondence_recipients TO ${reader};
  ${policies}
  ${fn('ue_load_queued_case_mail','task jsonb',QUEUED_CASE_MAIL_LOAD_BODY)}
  ${fn('ue_issue_queued_case_mail','queue_id uuid',QUEUED_CASE_MAIL_MINT_BODY)}
  ${fn('ue_queued_case_mail_context','queue_id uuid,capability text',QUEUED_CASE_MAIL_CONTEXT_BODY)}
  GRANT EXECUTE ON FUNCTION public.ue_issue_queued_case_mail(uuid) TO union_eyes_runtime;
  GRANT EXECUTE ON FUNCTION public.ue_queued_case_mail_context(uuid,text) TO union_eyes_system;
  REVOKE CREATE ON SCHEMA public FROM ${reader};
  CREATE FUNCTION public.ue_lock_queued_mail_authority() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $ue_mail_lock$${QUEUED_CASE_MAIL_LOCK_BODY}$ue_mail_lock$;
  ALTER FUNCTION public.ue_lock_queued_mail_authority() OWNER TO ue_v2_owner;
  REVOKE ALL ON FUNCTION public.ue_lock_queued_mail_authority() FROM PUBLIC,union_eyes_runtime,union_eyes_system;
  ${[
    ['user_management.users','principal','user_id'],['user_management.organization_users','principal','user_id'],['user_management.user_sessions','principal','user_id'],
    ['public.ue_authority_resource_relationships','principal','principal_user_id'],['public.ue_authority_recusals','principal','principal_user_id'],
    ['public.ue_authority_mandates','principal','principal_user_id'],['public.ue_authority_delegations','principal','delegator_user_id','delegate_user_id'],['public.ue_authority_acceptances','principal','accepted_by'],
    ['public.claims','resource','claim_id'],['public.grievances','resource','id'],
    ['public.bargaining_units','resource','id'],['public.case_territories','resource','id'],
    ['public.correspondence','resource','id'],['public.correspondence_recipients','resource','correspondence_id'],
  ].map(([table,kind,column,other])=>`CREATE TRIGGER ue_lock_queued_mail_authority BEFORE INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION public.ue_lock_queued_mail_authority('${kind}','${column}'${other?`, '${other}'`:''});`).join('\n')}
  CREATE FUNCTION public.ue_guard_queued_mail_capability() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $ue_mail$${QUEUED_CASE_MAIL_RESERVED_BODY}$ue_mail$;
  ALTER FUNCTION public.ue_guard_queued_mail_capability() OWNER TO ue_v2_owner;
  REVOKE ALL ON FUNCTION public.ue_guard_queued_mail_capability() FROM PUBLIC,union_eyes_runtime,union_eyes_system;
  CREATE TRIGGER ue_guard_queued_mail_capability BEFORE INSERT OR UPDATE OR DELETE ON public.ue_authority_requests FOR EACH ROW EXECUTE FUNCTION public.ue_guard_queued_mail_capability();
  CREATE TRIGGER ue_record_queued_mail_capability AFTER INSERT ON public.ue_authority_requests FOR EACH ROW WHEN (NEW.operation='${QUEUED_CASE_MAIL_OPERATION}') EXECUTE FUNCTION public.ue_authority_record_event();`
}

const EXPECTED_MAIL_FUNCTIONS = [
  { name:'ue_load_queued_case_mail', body:QUEUED_CASE_MAIL_LOAD_BODY, owner:QUEUED_CASE_MAIL_OWNER, definer:true, args:'3802', returns:'jsonb', runtime:false, system:false },
  { name:'ue_issue_queued_case_mail', body:QUEUED_CASE_MAIL_MINT_BODY, owner:QUEUED_CASE_MAIL_OWNER, definer:true, args:'2950', returns:'jsonb', runtime:true, system:false },
  { name:'ue_queued_case_mail_context', body:QUEUED_CASE_MAIL_CONTEXT_BODY, owner:QUEUED_CASE_MAIL_OWNER, definer:true, args:'2950 25', returns:'jsonb', runtime:false, system:true },
  { name:'ue_guard_queued_mail_capability', body:QUEUED_CASE_MAIL_RESERVED_BODY, owner:'ue_v2_owner', definer:false, args:'', returns:'trigger', runtime:false, system:false },
  { name:'ue_lock_queued_mail_authority', body:QUEUED_CASE_MAIL_LOCK_BODY, owner:'ue_v2_owner', definer:false, args:'', returns:'trigger', runtime:false, system:false },
] as const
export const QUEUED_CASE_MAIL_FUNCTION_SIGNATURES = [
  'ue_load_queued_case_mail(jsonb)','ue_issue_queued_case_mail(uuid)','ue_queued_case_mail_context(uuid,text)',
] as const
export const QUEUED_CASE_MAIL_FUNCTION_CATALOG_QUERY = `SELECT p.oid::text,p.proname AS name,p.prosrc AS body,
  pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS definer,p.provolatile,p.proconfig,p.proargtypes::text AS args,
  p.prorettype::regtype::text AS returns,p.proleakproof,p.proretset,p.proisstrict,l.lanname AS language,
  has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,
  has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS runtime_execute,
  has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS system_execute,
  NOT EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='union_eyes_runtime'),
      (SELECT oid FROM pg_roles WHERE rolname='union_eyes_system')) OR (a.is_grantable AND a.grantee<>p.proowner)) AS exact_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='public' AND p.proname IN (${EXPECTED_MAIL_FUNCTIONS.map(fn=>`'${fn.name}'`).join(',')})`

/** Function admission only; installation qualification must also compare the source-bound policies, column grants and writer triggers. */
export function queuedCaseMailFunctionViolations(rows: Record<string,unknown>[]): string[] {
  const errors:string[]=[]
  for(const expected of EXPECTED_MAIL_FUNCTIONS){
    const matches=rows.filter(row=>row.name===expected.name), row=matches[0]
    if(matches.length!==1||!row||row.body!==expected.body||row.owner!==expected.owner||row.definer!==expected.definer
      ||row.args!==expected.args||row.returns!==expected.returns||row.provolatile!=='v'||row.language!=='plpgsql'
      ||row.proleakproof!==false||row.proretset!==false||row.proisstrict!==false
      ||JSON.stringify(row.proconfig)!==JSON.stringify(['search_path=pg_catalog'])||row.public_execute!==false
      ||row.runtime_execute!==expected.runtime||row.system_execute!==expected.system||row.exact_acl!==true)
      errors.push(`queued-mail function authority or body differs: ${expected.name}`)
  }
  if(rows.length!==EXPECTED_MAIL_FUNCTIONS.length)errors.push('queued-mail function count differs')
  return errors
}
