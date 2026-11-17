/** Current, additive case persistence boundary. Released 0049 is provenance, never an executable producer. */
import { ROLE_CAPACITIES } from '../../lib/authority/capacity'
import { ACTIVE_CASE_RESPONDENT_SQL, ACTIVE_RECUSAL_SQL, PRIMARY_CASE_HANDLER_ONLY_ACTIONS } from '../../lib/authority/common'
import {AUTHORITY_PHYSICAL_GUARDS} from './authority-physical-guards'
import type { PhysicalGuardContract } from './physical-guard-catalog'

const literal=(value:string)=>`'${value.replaceAll("'","''")}'`
const roles=(capacities:readonly string[])=>Object.entries(ROLE_CAPACITIES).filter(([,held])=>held.some(cap=>capacities.includes(cap))).map(([role])=>literal(role)).join(',')
const handlerRoles=roles(['steward','chief_steward','officer']),supervisorRoles=roles(['chief_steward','officer','executive'])
const primaryActions=PRIMARY_CASE_HANDLER_ONLY_ACTIONS.map(literal).join(',')
const activeRecusal=ACTIVE_RECUSAL_SQL.replaceAll('clock_timestamp()','checked_at')
const activeRespondent=ACTIVE_CASE_RESPONDENT_SQL.replaceAll('clock_timestamp()','checked_at')
const live=(alias:string)=>`${alias}.status='active' AND ${alias}.revoked_at IS NULL AND isfinite(${alias}.effective_at)
  AND ${alias}.effective_at<=checked_at AND (${alias}.expires_at IS NULL OR (isfinite(${alias}.expires_at) AND ${alias}.expires_at>checked_at AND ${alias}.expires_at>${alias}.effective_at))`
const accepted=(alias:string,kind:string,person:string)=>`NOT EXISTS(SELECT FROM public.ue_authority_acceptances invalid WHERE invalid.organization_id=row_org AND invalid.instrument_type='${kind}' AND invalid.instrument_id=${alias}.id AND invalid.accepted_by=${person} AND (NOT isfinite(invalid.accepted_at) OR invalid.accepted_at>checked_at)) AND (NOT ${alias}.requires_acceptance OR EXISTS(SELECT FROM public.ue_authority_acceptances a
  WHERE a.organization_id=row_org AND a.instrument_type='${kind}' AND a.instrument_id=${alias}.id AND a.accepted_by=${person}
    AND isfinite(a.accepted_at) AND a.accepted_at<=checked_at))`
const validPowers=(alias:string)=>`cardinality(${alias}.powers)>0 AND array_position(${alias}.powers,NULL) IS NULL
  AND NOT EXISTS(SELECT FROM unnest(${alias}.powers) power WHERE power='' OR power<>btrim(power))`
const canonicalScopeValidation=AUTHORITY_PHYSICAL_GUARDS.functions.find(fn=>fn.name==='ue_authority_scope_valid')
if(!canonicalScopeValidation || canonicalScopeValidation.language!=='sql' || canonicalScopeValidation.volatility!=='i')throw new Error('Canonical immutable mandate scope validation required')
const validScope=(alias:string)=>`(${canonicalScopeValidation.body.trim().replace(/^SELECT\s+/i,'').replace(/\bscope\b/g,`${alias}.scope`)})`
const owner='nzila_auth_org_authority_reader'
const trustedOwner=`current_user='ue_v2_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper)`

/** Boolean only, real-session-bound, and independent of the caller's incomplete RLS view of restrictions. */
export const CASE_DOMAIN_AUTHORIZED_BODY=`
#variable_conflict use_variable
DECLARE actor text:=NULLIF(current_setting('app.current_user_id',true),''); member_role text; checked_at timestamptz;
  delegated uuid; delegator text; s record; c record; g record; has_claim boolean; has_grievance boolean;
  privileged boolean:=false; confidential boolean:=false; primary_only boolean:=requested_action IN (${primaryActions});
  power text:=replace(requested_action,'case:',''); allowed boolean:=false;
  prior_org text:=current_setting('ue.case_domain_org',true); prior_case text:=current_setting('ue.case_domain_case',true);
  prior_people text:=current_setting('ue.case_domain_people',true);
BEGIN
  <<decision>>
  BEGIN
  IF actor IS NULL OR requested_action NOT IN ('case:transition','case:close','case:disclose_to_member','case:comment','case:write_notes','case:assign')
    OR NOT user_management.auth_business_org_authorized(row_org,NULL::text[]) THEN EXIT decision; END IF;
  PERFORM set_config('ue.case_domain_org',row_org::text,true);
  PERFORM set_config('ue.case_domain_case',target_case_id::text,true);
  PERFORM set_config('ue.case_domain_people',ARRAY[actor]::text,true);
  IF NOT primary_only AND NULLIF(current_setting('app.authority_delegation_id',true),'') IS NOT NULL THEN
    BEGIN delegated:=current_setting('app.authority_delegation_id',true)::uuid; EXCEPTION WHEN invalid_text_representation THEN EXIT decision; END;
    SELECT delegator_user_id INTO delegator FROM public.ue_authority_delegations
      WHERE id=delegated AND organization_id=row_org AND delegate_user_id=actor;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||person,0))
    FROM (SELECT DISTINCT person FROM unnest(ARRAY[actor,delegator]) person WHERE person IS NOT NULL ORDER BY person) people;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||target_case_id::text,0));
  PERFORM set_config('ue.case_domain_people',array_remove(ARRAY[actor,delegator],NULL)::text,true);
  SELECT a.id,a.organization_id,a.case_id,a.claim_id,a.grievance_id,a.unit_id,a.territory_id,a.grievance_mirror_id,a.mirror_recorded_at,a.mirror_recorded_by,u.organization_id AS unit_org,t.organization_id AS territory_org,CASE WHEN u.organization_id=row_org AND u.status::text='active' AND u.archived_at IS NULL THEN u.id END AS live_unit,
    CASE WHEN t.organization_id=row_org AND t.retired_at IS NULL AND length(btrim(t.source_instrument))>0 THEN t.id END AS live_territory
    INTO s FROM public.case_authority_scopes a LEFT JOIN public.bargaining_units u ON u.id=a.unit_id
    LEFT JOIN public.case_territories t ON t.id=a.territory_id WHERE a.organization_id=row_org AND a.case_id=target_case_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||resource,0))
    FROM (SELECT DISTINCT resource FROM unnest(ARRAY[s.live_unit::text,s.live_territory::text]) resource WHERE resource IS NOT NULL ORDER BY resource) resources;
  SELECT organization_id,CASE WHEN organization_id=row_org AND status::text='active' AND archived_at IS NULL THEN id END INTO s.unit_org,s.live_unit FROM public.bargaining_units WHERE id=s.unit_id;
  SELECT organization_id,CASE WHEN organization_id=row_org AND retired_at IS NULL AND length(btrim(source_instrument))>0 THEN id END INTO s.territory_org,s.live_territory FROM public.case_territories WHERE id=s.territory_id;
  checked_at:=clock_timestamp();
  IF NOT user_management.auth_business_org_authorized(row_org,NULL::text[]) THEN EXIT decision; END IF;
  SELECT lower(m.role) INTO member_role FROM user_management.organization_users m JOIN user_management.users u USING(user_id)
    WHERE m.organization_id=row_org AND m.user_id=actor AND m.is_active AND u.is_active AND u.lifecycle_state='active';
  IF NOT FOUND OR (SELECT count(*) FROM user_management.organization_users WHERE organization_id=row_org AND user_id=actor)<>1 THEN EXIT decision; END IF;
  SELECT id,claim_id,member_id INTO c FROM public.claims WHERE organization_id=row_org AND claim_id=target_case_id;has_claim:=FOUND;
  SELECT id,created_by,grievant_id,represented_member_user_id,has_legal_implications,is_confidential INTO g
    FROM public.grievances WHERE organization_id=row_org AND id=target_case_id;has_grievance:=FOUND;
  IF NOT has_claim AND NOT has_grievance THEN EXIT decision; END IF;
  IF (SELECT count(*) FROM public.case_authority_scopes WHERE organization_id=row_org AND case_id=target_case_id)>1 THEN EXIT decision; END IF;
  IF has_claim AND has_grievance THEN
    IF s.id IS NULL OR s.claim_id IS DISTINCT FROM target_case_id OR s.grievance_id IS NOT NULL
      OR s.grievance_mirror_id IS DISTINCT FROM target_case_id OR s.mirror_recorded_at IS NULL OR NOT isfinite(s.mirror_recorded_at)
      OR s.mirror_recorded_at>checked_at OR s.mirror_recorded_by IS NULL OR length(s.mirror_recorded_by) NOT BETWEEN 1 AND 255 OR s.mirror_recorded_by<>btrim(s.mirror_recorded_by) OR s.mirror_recorded_by ~ '[[:cntrl:]]'
      OR g.represented_member_user_id IS DISTINCT FROM c.member_id THEN EXIT decision; END IF;
  ELSIF s.id IS NOT NULL AND ((has_claim AND s.claim_id IS DISTINCT FROM target_case_id) OR (has_grievance AND s.grievance_id IS DISTINCT FROM target_case_id)) THEN EXIT decision; END IF;
  IF (s.unit_id IS NOT NULL AND s.unit_org IS DISTINCT FROM row_org) OR (s.territory_id IS NOT NULL AND s.territory_org IS DISTINCT FROM row_org) THEN EXIT decision; END IF;
  IF has_grievance AND g.represented_member_user_id IS NOT NULL AND g.grievant_id IS NOT NULL AND g.represented_member_user_id<>g.grievant_id::text THEN EXIT decision; END IF;
  IF s.territory_id IS NOT NULL AND s.live_territory IS NULL THEN s.live_territory:=NULL; END IF;
  IF EXISTS(SELECT FROM public.ue_authority_recusals WHERE organization_id=row_org AND principal_user_id=actor
      AND resource_type='case' AND resource_id=target_case_id AND ${activeRecusal})
    OR EXISTS(SELECT FROM public.case_respondents WHERE organization_id=row_org AND scope_id=s.id
      AND respondent_user_id=actor AND ${activeRespondent}) THEN EXIT decision; END IF;
  privileged:=has_grievance AND COALESCE(g.has_legal_implications,false);confidential:=has_grievance AND COALESCE(g.is_confidential,false);
  IF requested_action='case:comment' AND NOT privileged AND
    ((has_claim AND c.member_id=actor) OR (NOT has_claim AND (g.created_by=actor OR COALESCE(g.represented_member_user_id,g.grievant_id::text)=actor))) THEN allowed:=true; END IF;
  IF requested_action<>'case:assign' AND member_role IN (${handlerRoles}) AND EXISTS(SELECT FROM public.ue_authority_resource_relationships r
    WHERE r.organization_id=row_org AND r.resource_type='case' AND r.resource_id=target_case_id AND r.principal_user_id=actor AND ${live('r')}
      AND r.origin='explicit' AND r.granted_by IS NOT NULL AND r.granted_by<>actor
      AND array_position(r.permissions,NULL) IS NULL AND NOT EXISTS(SELECT FROM unnest(r.permissions) permission WHERE permission='' OR permission<>btrim(permission))
      AND (r.relation IN ('owner','assignee') OR (NOT primary_only AND r.relation='collaborator' AND power=ANY(r.permissions)))
      AND (NOT privileged OR r.privileged_access)) THEN allowed:=true; END IF;
  IF NOT primary_only AND (NOT privileged OR requested_action='case:assign') AND member_role IN (${supervisorRoles}) AND EXISTS(
    SELECT FROM public.ue_authority_mandates m WHERE m.organization_id=row_org AND m.principal_user_id=actor AND m.kind='supervisory'
      AND ${live('m')} AND m.expires_at IS NOT NULL AND ${accepted('m','mandate','actor')} AND ${validPowers('m')}
      AND length(btrim(m.source_instrument))>0 AND m.granted_by<>actor AND ${validScope('m')}
      AND NOT(m.powers && ARRAY['read_privileged','close','disclose_to_member','export_sealed_evidence','case:close','case:disclose_to_member','case:export_sealed_evidence'])
      AND power=ANY(m.powers) AND (NOT confidential OR m.scope->>'classificationCeiling'='confidential')
      AND (m.scope->'resourceIds' ? target_case_id::text OR (s.live_unit IS NOT NULL AND m.scope->'unitIds' ? s.live_unit::text)
        OR (s.live_territory IS NOT NULL AND m.scope->'territoryIds' ? s.live_territory::text))) THEN allowed:=true; END IF;
  IF NOT primary_only AND NOT privileged AND delegated IS NOT NULL AND delegator IS NOT NULL
    AND NOT EXISTS(SELECT FROM public.case_respondents WHERE organization_id=row_org AND scope_id=s.id AND respondent_user_id=delegator AND ${activeRespondent})
    AND NOT EXISTS(SELECT FROM public.ue_authority_recusals WHERE organization_id=row_org AND principal_user_id=delegator
      AND resource_type='case' AND resource_id=target_case_id AND ${activeRecusal})
    AND (SELECT count(*) FROM user_management.organization_users WHERE organization_id=row_org AND user_id=delegator)=1
    AND EXISTS(SELECT FROM user_management.organization_users m JOIN user_management.users u USING(user_id)
      WHERE m.organization_id=row_org AND m.user_id=delegator AND m.is_active AND u.is_active AND u.lifecycle_state='active')
    AND EXISTS(SELECT FROM public.ue_authority_delegations d WHERE d.id=delegated AND d.organization_id=row_org AND d.delegate_user_id=actor
      AND d.delegator_user_id=delegator AND delegator<>actor AND ${live('d')} AND d.expires_at IS NOT NULL
      AND requested_action=ANY(d.actions) AND 'case'=ANY(d.resource_types) AND array_position(d.actions,NULL) IS NULL AND array_position(d.resource_types,NULL) IS NULL
      AND NOT EXISTS(SELECT FROM unnest(d.actions||d.resource_types) value WHERE value='' OR value<>btrim(value))
      AND ${accepted('d','delegation','actor')}
      AND EXISTS(SELECT FROM public.ue_authority_mandates m WHERE m.organization_id=row_org AND m.principal_user_id=delegator AND m.kind='executive_office'
        AND ${live('m')} AND m.expires_at IS NOT NULL AND ${accepted('m','mandate','delegator')} AND ${validPowers('m')}
        AND length(btrim(m.source_instrument))>0 AND m.granted_by<>delegator AND power=ANY(m.powers))) THEN allowed:=true; END IF;
  END decision;
  PERFORM set_config('ue.case_domain_org',COALESCE(prior_org,''),true);
  PERFORM set_config('ue.case_domain_case',COALESCE(prior_case,''),true);
  PERFORM set_config('ue.case_domain_people',COALESCE(prior_people,''),true);
  RETURN allowed;
END;
`

export const CASE_CLOSURE_WRITE_BODY=`
DECLARE target uuid; actor text:=NULLIF(current_setting('app.current_user_id',true),''); closed_statuses text[]:=ARRAY['closed','rejected','withdrawn','denied','closed_no_case']; sensitive boolean;
BEGIN
  IF ${trustedOwner} THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='claims' THEN target:=NEW.claim_id;
    IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.claim_id IS DISTINCT FROM OLD.claim_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.member_id IS DISTINCT FROM OLD.member_id) THEN RAISE EXCEPTION 'CASE_IDENTITY_IMMUTABLE' USING ERRCODE='42501'; END IF;
  ELSE target:=NEW.id;
    IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.grievant_id IS DISTINCT FROM OLD.grievant_id OR NEW.represented_member_user_id IS DISTINCT FROM OLD.represented_member_user_id) THEN RAISE EXCEPTION 'CASE_IDENTITY_IMMUTABLE' USING ERRCODE='42501'; END IF;
  END IF;
  IF actor IS NULL OR NOT user_management.auth_business_org_authorized(NEW.organization_id,NULL::text[]) THEN RAISE EXCEPTION 'LIVE_CASE_ACTOR_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||actor,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||target::text,0));
  IF TG_OP='INSERT' THEN
    IF NEW.status::text=ANY(closed_statuses) OR NEW.closed_at IS NOT NULL THEN RAISE EXCEPTION 'PRIMARY_CASE_HANDLER_REQUIRED: initial closure is not an intake' USING ERRCODE='42501'; END IF;
  ELSE
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NOT public.ue_case_domain_authorized(NEW.organization_id,target,'case:transition') THEN RAISE EXCEPTION 'CASE_TRANSITION_AUTHORITY_REQUIRED' USING ERRCODE='42501'; END IF;
      sensitive:=OLD.status::text=ANY(closed_statuses) OR NEW.status::text=ANY(closed_statuses);
      IF sensitive AND NOT public.ue_case_domain_authorized(NEW.organization_id,target,'case:close') THEN RAISE EXCEPTION 'PRIMARY_CASE_HANDLER_REQUIRED' USING ERRCODE='42501'; END IF;
      IF NEW.status::text=ANY(closed_statuses) THEN NEW.closed_at:=clock_timestamp(); ELSIF OLD.status::text=ANY(closed_statuses) THEN NEW.closed_at:=NULL; END IF;
    ELSIF OLD.closed_at IS DISTINCT FROM NEW.closed_at THEN RAISE EXCEPTION 'CASE_CLOSURE_CLOCK_IMMUTABLE' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
`
export const CLAIM_STATUS_STAMP_BODY=`
BEGIN
  IF TG_OP='INSERT' THEN NEW.status_changed_at:=clock_timestamp();
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_changed_at:=clock_timestamp();
  ELSE NEW.status_changed_at:=OLD.status_changed_at; END IF;
  RETURN NEW;
END;
`
export const CASE_DISCLOSURE_WRITE_BODY=`
DECLARE c record; actor text:=NULLIF(current_setting('app.current_user_id',true),''); origin record; safe_state boolean;
BEGIN
  IF ${trustedOwner} THEN IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CASE_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END IF;
  SELECT id,claim_id,organization_id,member_id,status::text AS status INTO c FROM public.claims WHERE id=NEW.claim_id;
  IF NOT FOUND OR actor IS NULL OR NEW.created_by IS DISTINCT FROM actor OR NOT user_management.auth_business_org_authorized(c.organization_id,NULL::text[]) THEN RAISE EXCEPTION 'CASE_HISTORY_ACTOR_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||actor,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||c.claim_id::text,0));
  SELECT id,claim_id,organization_id,member_id,status::text AS status INTO c FROM public.claims WHERE id=NEW.claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_HISTORY_ORIGIN_REQUIRED' USING ERRCODE='42501'; END IF;
  NEW.created_at:=clock_timestamp();NEW.updated_at:=NEW.created_at;
  safe_state:=NEW.update_type='status_change' AND NEW.is_internal IS FALSE AND NEW.visibility_scope::text='member'
    AND jsonb_typeof(NEW.metadata)='object' AND NEW.metadata ?& ARRAY['previousStatus','newStatus']
    AND (NEW.metadata-ARRAY['previousStatus','newStatus'])='{}'::jsonb
    AND NEW.metadata->>'newStatus'=c.status AND NEW.metadata->>'previousStatus'<>c.status
    AND NEW.message='Status changed from '||quote_literal(NEW.metadata->>'previousStatus')||' to '||quote_literal(c.status);
  IF safe_state THEN
    SELECT j.* INTO origin FROM public.claim_status_transitions j WHERE j.organization_id=c.organization_id AND j.claim_id=c.id
      AND j.transaction_id=txid_current() AND j.changed_by=actor AND j.from_status=NEW.metadata->>'previousStatus' AND j.to_status=c.status
      AND j.changed_at>=transaction_timestamp() AND j.changed_at<=NEW.created_at AND public.ue_case_domain_row_current(j.xmin)
      AND (NEW.transition_id IS NULL OR j.id=NEW.transition_id);
    IF NOT FOUND OR (SELECT count(*) FROM public.claim_status_transitions j WHERE j.organization_id=c.organization_id AND j.claim_id=c.id
      AND j.transaction_id=txid_current() AND j.changed_by=actor AND j.from_status=NEW.metadata->>'previousStatus' AND j.to_status=c.status AND public.ue_case_domain_row_current(j.xmin))<>1
      OR NOT public.ue_case_domain_authorized(c.organization_id,c.claim_id,'case:transition') THEN RAISE EXCEPTION 'ACTUAL_CASE_TRANSITION_REQUIRED' USING ERRCODE='42501'; END IF;
    NEW.transition_id:=origin.id;RETURN NEW;
  END IF;
  IF NEW.transition_id IS NOT NULL OR NEW.update_type='status_change' THEN RAISE EXCEPTION 'EXACT_STATE_PROJECTION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NEW.is_internal IS TRUE AND NEW.visibility_scope::text IN ('staff','admin') THEN
    IF public.ue_case_domain_authorized(c.organization_id,c.claim_id,CASE WHEN NEW.update_type='assignment' THEN 'case:assign' ELSE 'case:write_notes' END) THEN RETURN NEW; END IF;
  ELSIF NEW.is_internal IS FALSE AND NEW.visibility_scope::text='member' THEN
    IF public.ue_case_domain_authorized(c.organization_id,c.claim_id,'case:disclose_to_member') THEN RETURN NEW; END IF;
    IF NEW.update_type IN ('note','comment') AND c.member_id=actor AND COALESCE(NEW.metadata,'{}'::jsonb)='{}'::jsonb
      AND public.ue_case_domain_authorized(c.organization_id,c.claim_id,'case:comment') THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'CASE_HISTORY_AUTHORITY_REQUIRED' USING ERRCODE='42501';
END;
`
export const CLAIM_JOURNAL_WRITE_BODY=`
BEGIN
  IF NULLIF(current_setting('app.current_user_id',true),'') IS NULL OR NOT user_management.auth_business_org_authorized(NEW.organization_id,NULL::text[]) THEN RETURN NULL; END IF;
  PERFORM set_config('ue.case_domain_org',NEW.organization_id::text,true);
  PERFORM set_config('ue.case_domain_internal',NEW.id::text,true);
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.claim_status_transitions(id,organization_id,claim_id,from_status,to_status,changed_at,changed_by,transaction_id)
      VALUES(gen_random_uuid(),NEW.organization_id,NEW.id,CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status::text END,NEW.status::text,NEW.status_changed_at,NULLIF(current_setting('app.current_user_id',true),''),txid_current());
  END IF;
  RETURN NULL;
END;
`

/** MVCC-visible in-progress rows are ours, including released savepoint children. Restored txid values are not proof. */
export const CASE_DOMAIN_ROW_CURRENT_BODY=`
DECLARE top_id numeric:=pg_current_xact_id()::text::numeric; candidate numeric;
BEGIN
  candidate:=floor(top_id/4294967296)*4294967296+row_xmin::text::numeric;
  IF candidate<top_id THEN candidate:=candidate+4294967296; END IF;
  RETURN pg_xact_status(candidate::text::xid8)='in progress';
EXCEPTION WHEN invalid_parameter_value THEN RETURN false;
END;
`
export const CLAIM_JOURNAL_IMMUTABLE_BODY=`
BEGIN
  IF TG_OP='INSERT' AND current_user='${owner}' AND pg_trigger_depth()>1
    AND NEW.transaction_id=txid_current() AND NEW.changed_by=NULLIF(current_setting('app.current_user_id',true),'') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CASE_TRANSITION_JOURNAL_IMMUTABLE' USING ERRCODE='42501';
END;
`
export const CLAIM_JOURNAL_AUDIT_BODY=`
DECLARE c record; actor text:=NULLIF(current_setting('app.current_user_id',true),'');
BEGIN
  PERFORM set_config('ue.case_domain_org',NEW.organization_id::text,true);
  PERFORM set_config('ue.case_domain_internal',NEW.claim_id::text,true);
  SELECT id,claim_id,organization_id,status::text AS status INTO c FROM public.claims WHERE id=NEW.claim_id AND organization_id=NEW.organization_id;
  IF NOT FOUND OR NEW.transaction_id IS DISTINCT FROM txid_current() OR NEW.changed_by IS DISTINCT FROM actor
    OR NOT EXISTS(SELECT FROM public.claim_status_transitions stored WHERE stored.id=NEW.id AND public.ue_case_domain_row_current(stored.xmin)) THEN RAISE EXCEPTION 'CASE_TRANSITION_ORIGIN_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NEW.from_status IS NOT NULL AND NOT EXISTS(SELECT FROM public.claim_updates h WHERE h.transition_id=NEW.id
    AND h.claim_id=NEW.claim_id AND h.created_by=actor AND h.update_type='status_change' AND h.is_internal IS FALSE AND h.visibility_scope::text='member'
    AND h.metadata=jsonb_build_object('previousStatus',NEW.from_status,'newStatus',NEW.to_status)
    AND h.message='Status changed from '||quote_literal(NEW.from_status)||' to '||quote_literal(NEW.to_status)
    AND public.ue_case_domain_row_current(h.xmin) AND h.created_at>=NEW.changed_at) THEN RAISE EXCEPTION 'CASE_TRANSITION_HISTORY_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT FROM public.audit_logs a WHERE a.organization_id=NEW.organization_id AND a.user_id=actor
    AND a.resource_type='claims' AND a.resource_id=c.claim_id::text AND a.created_at>=NEW.changed_at AND a.created_at<=clock_timestamp()
    AND public.ue_case_domain_row_current(a.xmin) AND ((NEW.from_status IS NULL AND a.action='claim.create') OR
      (NEW.from_status IS NOT NULL AND a.action='case.transition' AND a.details->>'from'=NEW.from_status AND a.details->>'to'=NEW.to_status)))
    THEN RAISE EXCEPTION 'CASE_TRANSITION_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
`
export const CASE_HISTORY_AUDIT_BODY=`
DECLARE c record;
BEGIN
  IF NEW.transition_id IS NOT NULL THEN RETURN NULL; END IF;
  PERFORM set_config('ue.case_domain_internal',NEW.claim_id::text,true);
  PERFORM set_config('ue.case_domain_org',COALESCE(current_setting('app.current_org_id',true),''),true);
  SELECT organization_id,claim_id INTO c FROM public.claims WHERE id=NEW.claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_HISTORY_ORIGIN_REQUIRED' USING ERRCODE='23514'; END IF;
  PERFORM set_config('ue.case_domain_org',c.organization_id::text,true);
  IF NOT EXISTS(SELECT FROM public.audit_logs a WHERE a.organization_id=c.organization_id AND a.user_id=NEW.created_by
    AND public.ue_case_domain_row_current(a.xmin) AND a.created_at>=NEW.created_at AND a.created_at<=clock_timestamp()
    AND ((a.resource_type='claim_updates' AND a.resource_id IN (NEW.update_id::text,NEW.id::text)) OR
      (NEW.update_type='assignment' AND a.resource_type='claims' AND a.resource_id=c.claim_id::text AND a.action='case.assign')))
    THEN RAISE EXCEPTION 'CASE_HISTORY_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
`
export const GRIEVANCE_TRANSITION_AUDIT_BODY=`
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
  IF NULLIF(current_setting('app.current_user_id',true),'') IS NULL THEN RETURN NULL; END IF;
  PERFORM set_config('ue.case_domain_org',NEW.organization_id::text,true);
  PERFORM set_config('ue.case_domain_case',NEW.id::text,true);
  IF NOT EXISTS(SELECT FROM public.grievance_events e WHERE e.grievance_id=NEW.id AND e.event_type::text='status_changed'
    AND e.actor_user_id=current_setting('app.current_user_id',true) AND public.ue_case_domain_row_current(e.xmin)
    AND e.notes='Status changed: '||OLD.status::text||' → '||NEW.status::text)
    OR NOT EXISTS(SELECT FROM public.audit_logs a WHERE a.organization_id=NEW.organization_id
      AND a.resource_type='grievances' AND a.resource_id=NEW.id::text AND a.user_id=current_setting('app.current_user_id',true)
      AND public.ue_case_domain_row_current(a.xmin) AND a.action='grievance.status_change'
      AND a.details->'previousState'->>'status'=OLD.status::text AND a.details->'newState'->>'status'=NEW.status::text)
    THEN RAISE EXCEPTION 'GRIEVANCE_TRANSITION_HISTORY_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END;
`

const functionSpec=(name:string,body:string,returns='trigger',args='',callable=false)=>({name,body,returns,args,volatility:'v',language:'plpgsql',path:'pg_catalog,public,pg_temp',callable})
const trigger=(table:string,name:string,fn:string,events:string,deferrable=false)=>({table_name:table,name,function_name:fn,
  tgtype:events==='INSERT OR DELETE OR UPDATE'?31:events==='INSERT OR UPDATE'?(deferrable?21:23):events==='INSERT'?5:events==='UPDATE'?17:21,
  tgdeferrable:deferrable,tginitdeferred:deferrable,args_hex:'',
  definition:`CREATE ${deferrable?'CONSTRAINT ':''}TRIGGER ${name} ${deferrable?'AFTER':'BEFORE'} ${events} ON public.${table} ${deferrable?'DEFERRABLE INITIALLY DEFERRED ':''}FOR EACH ROW EXECUTE FUNCTION public.${fn}()`})
const reference='db/migrations-platform/0049_claim_status_transitions.sql'
export const CASE_PRIMARY_DOMAIN_GUARDS:PhysicalGuardContract={
  source:'apps/union-eyes/db/auth/case-primary-domain-guards.ts',references:[{path:reference,sha256:'ba7d67d0fd7cebe99a7d9f249bbe8f95432c7587bbc0858f4aa89d73c5c61550'}],
  tables:['claims','grievances','claim_updates','claim_status_transitions','grievance_events','audit_logs'],
  functions:[functionSpec('ue_guard_case_closure_write',CASE_CLOSURE_WRITE_BODY),functionSpec('ue_claims_stamp_status_changed',CLAIM_STATUS_STAMP_BODY),
    functionSpec('ue_guard_case_disclosure_write',CASE_DISCLOSURE_WRITE_BODY),functionSpec('ue_guard_claim_journal_immutable',CLAIM_JOURNAL_IMMUTABLE_BODY)],
  constraints:[],triggers:[
    trigger('claims','ue_case_primary_closure','ue_guard_case_closure_write','INSERT OR UPDATE'),
    trigger('grievances','ue_case_primary_closure','ue_guard_case_closure_write','INSERT OR UPDATE'),
    trigger('claims','ue_claims_stamp_status_changed','ue_claims_stamp_status_changed','INSERT OR UPDATE'),
    {...trigger('claims','ue_claims_record_status_transition','ue_claims_record_status_transition','INSERT OR UPDATE'),tgtype:21,
      definition:'CREATE TRIGGER ue_claims_record_status_transition AFTER INSERT OR UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.ue_claims_record_status_transition()'},
    trigger('claim_updates','ue_case_primary_disclosure','ue_guard_case_disclosure_write','INSERT OR DELETE OR UPDATE'),
    trigger('claim_status_transitions','ue_claim_journal_immutable','ue_guard_claim_journal_immutable','INSERT OR DELETE OR UPDATE'),
    trigger('claim_status_transitions','ue_claim_journal_audit','ue_check_claim_journal_audit','INSERT',true),
    trigger('claim_updates','ue_claim_history_audit','ue_check_case_history_audit','INSERT',true),
    trigger('grievances','ue_grievance_status_audit','ue_check_grievance_transition_audit','UPDATE',true),
  ],
}
const supportFunctions=[
  {name:'ue_case_domain_authorized',args:'row_org uuid, target_case_id uuid, requested_action text',returns:'boolean',body:CASE_DOMAIN_AUTHORIZED_BODY,callable:true},
  {name:'ue_case_domain_row_current',args:'row_xmin xid',returns:'boolean',body:CASE_DOMAIN_ROW_CURRENT_BODY,callable:true},
  {name:'ue_claims_record_status_transition',args:'',returns:'trigger',body:CLAIM_JOURNAL_WRITE_BODY,callable:false},
  {name:'ue_check_claim_journal_audit',args:'',returns:'trigger',body:CLAIM_JOURNAL_AUDIT_BODY,callable:false},
  {name:'ue_check_case_history_audit',args:'',returns:'trigger',body:CASE_HISTORY_AUDIT_BODY,callable:false},
  {name:'ue_check_grievance_transition_audit',args:'',returns:'trigger',body:GRIEVANCE_TRANSITION_AUDIT_BODY,callable:false},
]
export const CASE_DOMAIN_SUPPORT_FUNCTION_SIGNATURES=supportFunctions.map(fn=>`${fn.name}(${fn.args?fn.args.split(',').map(arg=>arg.trim().split(/\s+/).slice(1).join(' ')).join(','):''})`)
/** Called once, before the ordinary physical-guard planner. Existing support or alternate journal writers require reconciliation. */
export function compileCaseDomainSupportSql():string{
  const org=`organization_id::text=NULLIF(current_setting('ue.case_domain_org',true),'')`
  const people=`user_id=ANY(COALESCE(NULLIF(current_setting('ue.case_domain_people',true),''),'{}')::text[])`
  const authorityPeople=`principal_user_id=ANY(COALESCE(NULLIF(current_setting('ue.case_domain_people',true),''),'{}')::text[])`
  const policies=[
    ...['users','organization_users'].map(table=>`CREATE POLICY ue_case_domain_reader ON user_management.${table} FOR SELECT TO ${owner} USING (${table==='organization_users'?org+' AND ':''}${people})`),
    ...['ue_authority_resource_relationships','ue_authority_mandates','ue_authority_recusals'].map(table=>`CREATE POLICY ue_case_domain_reader ON public.${table} FOR SELECT TO ${owner} USING (${org} AND ${authorityPeople})`),
    `CREATE POLICY ue_case_domain_reader ON public.ue_authority_delegations FOR SELECT TO ${owner} USING (${org} AND delegate_user_id=NULLIF(current_setting('app.current_user_id',true),''))`,
    `CREATE POLICY ue_case_domain_reader ON public.ue_authority_acceptances FOR SELECT TO ${owner} USING (${org} AND accepted_by=ANY(COALESCE(NULLIF(current_setting('ue.case_domain_people',true),''),'{}')::text[]))`,
    ...['case_authority_scopes','case_respondents','bargaining_units','case_territories'].map(table=>`CREATE POLICY ue_case_domain_reader ON public.${table} FOR SELECT TO ${owner} USING (${org})`),
    `CREATE POLICY ue_case_domain_reader ON public.claims FOR SELECT TO ${owner} USING (${org} AND (claim_id::text=NULLIF(current_setting('ue.case_domain_case',true),'') OR id::text=NULLIF(current_setting('ue.case_domain_internal',true),'')))`,
    `CREATE POLICY ue_case_domain_reader ON public.grievances FOR SELECT TO ${owner} USING (${org} AND id::text=NULLIF(current_setting('ue.case_domain_case',true),''))`,
    `CREATE POLICY ue_case_domain_reader ON public.claim_status_transitions FOR SELECT TO ${owner} USING (${org} AND claim_id::text=NULLIF(current_setting('ue.case_domain_internal',true),''))`,
    `CREATE POLICY ue_case_domain_writer ON public.claim_status_transitions FOR INSERT TO ${owner} WITH CHECK (${org} AND claim_id::text=NULLIF(current_setting('ue.case_domain_internal',true),'') AND changed_by=NULLIF(current_setting('app.current_user_id',true),'') AND transaction_id=txid_current())`,
    `CREATE POLICY ue_case_domain_reader ON public.claim_updates FOR SELECT TO ${owner} USING (claim_id::text=NULLIF(current_setting('ue.case_domain_internal',true),''))`,
    `CREATE POLICY ue_case_domain_reader ON public.grievance_events FOR SELECT TO ${owner} USING (grievance_id::text=NULLIF(current_setting('ue.case_domain_case',true),''))`,
    `CREATE POLICY ue_case_domain_reader ON public.audit_logs FOR SELECT TO ${owner} USING (${org} AND user_id=NULLIF(current_setting('app.current_user_id',true),''))`,
  ]
  return `DO $ue_case_domain$ BEGIN
    IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN (${supportFunctions.map(fn=>literal(fn.name)).join(',')}))
      OR EXISTS(SELECT FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='public.claims'::regclass AND NOT t.tgisinternal AND p.prosrc LIKE '%claim_status_transitions%')
      THEN RAISE EXCEPTION 'Existing case domain journal/support requires exact reconciliation'; END IF;
    IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${owner}' AND NOT(rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole))
      OR has_schema_privilege('${owner}','public','CREATE') THEN RAISE EXCEPTION 'Bounded canonical reader required'; END IF;
  END $ue_case_domain$;
  GRANT CREATE ON SCHEMA public TO ${owner};
  GRANT SELECT(id,claim_id,organization_id,member_id,status) ON public.claims TO ${owner};
  GRANT SELECT(id,organization_id,created_by,grievant_id,represented_member_user_id,has_legal_implications,is_confidential) ON public.grievances TO ${owner};
  GRANT SELECT ON public.claim_status_transitions TO ${owner};
  GRANT INSERT(id,organization_id,claim_id,from_status,to_status,changed_at,changed_by,transaction_id) ON public.claim_status_transitions TO ${owner};
  GRANT SELECT(id,update_id,claim_id,transition_id,created_by,update_type,is_internal,visibility_scope,metadata,message,created_at) ON public.claim_updates TO ${owner};
  GRANT SELECT(grievance_id,event_type,actor_user_id,notes) ON public.grievance_events TO ${owner};
  GRANT SELECT(id,organization_id,delegator_user_id,delegate_user_id,actions,resource_types,status,effective_at,expires_at,revoked_at,requires_acceptance) ON public.ue_authority_delegations TO ${owner};
  GRANT SELECT(issuance_rule_id) ON public.ue_authority_resource_relationships TO ${owner};
  GRANT SELECT(resource_type,resource_id,user_id,xmin) ON public.audit_logs TO ${owner};
  GRANT SELECT(xmin) ON public.claim_updates,public.grievance_events TO ${owner};
  REVOKE INSERT,UPDATE,DELETE ON public.claim_status_transitions FROM PUBLIC,union_eyes_runtime,union_eyes_system;
  ${policies.join(';\n')};
  ${supportFunctions.map(fn=>`CREATE FUNCTION public.${fn.name}(${fn.args}) RETURNS ${fn.returns} LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $ue_case_domain$${fn.body}$ue_case_domain$;
    ALTER FUNCTION public.${fn.name}(${fn.args}) OWNER TO ${owner}; REVOKE ALL ON FUNCTION public.${fn.name}(${fn.args}) FROM PUBLIC,union_eyes_runtime,union_eyes_system;
    GRANT EXECUTE ON FUNCTION public.${fn.name}(${fn.args}) TO ue_v2_owner;
    ${fn.callable?`GRANT EXECUTE ON FUNCTION public.${fn.name}(${fn.args}) TO union_eyes_runtime;`:''}`).join('\n')}
  REVOKE CREATE ON SCHEMA public FROM ${owner};`
}

export const CASE_DOMAIN_SUPPORT_CATALOG_QUERY=`SELECT p.proname AS name,p.prosrc AS body,p.prosecdef,p.provolatile,p.proleakproof,p.proretset,p.proisstrict,l.lanname AS language,
  pg_get_function_identity_arguments(p.oid) AS args,p.prorettype::regtype::text AS returns,pg_get_userbyid(p.proowner) AS owner,p.proconfig,
  has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS runtime_execute,
  has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS system_execute,has_function_privilege('ue_v2_owner',p.oid,'EXECUTE') AS installer_execute,
  NOT EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='union_eyes_runtime'),(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner')) OR (a.is_grantable AND a.grantee<>p.proowner)) AS exact_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.proname IN (${supportFunctions.map(fn=>literal(fn.name)).join(',')}) ORDER BY p.proname,p.oid`
export function caseDomainSupportViolations(rows:Record<string,unknown>[]):string[]{
  const violations:string[]=[]
  for(const fn of supportFunctions){const matches=rows.filter(row=>row.name===fn.name),row=matches[0]
    if(matches.length!==1||row.body!==fn.body||row.args!==fn.args||row.returns!==fn.returns||row.owner!==owner||row.prosecdef!==true||row.provolatile!=='v'||row.language!=='plpgsql'||row.proleakproof!==false||row.proretset!==false||row.proisstrict!==false||row.installer_execute!==true
      ||JSON.stringify(row.proconfig)!==JSON.stringify(['search_path=pg_catalog'])||row.public_execute!==false||row.runtime_execute!==fn.callable||row.system_execute!==false||row.exact_acl!==true)violations.push(`${fn.name}: case domain authority differs`)
  }
  return violations
}
