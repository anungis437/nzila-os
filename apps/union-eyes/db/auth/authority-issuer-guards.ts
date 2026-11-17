/** Actual issuing authority is independent of possessing or copying an active issuance-rule id. */
import { ROLE_CAPACITIES } from '../../lib/authority/capacity'
import { ACTIVE_CASE_RESPONDENT_SQL, ACTIVE_RECUSAL_SQL } from '../../lib/authority/common'
import { INCOMPATIBLE_DUTIES } from '../../lib/authority/policies/finance'
import type { PhysicalGuardContract } from './physical-guard-catalog'

const quote=(value:string)=>`'${value.replaceAll("'","''")}'`
const caps=(role:string)=>`CASE lower(${role}) ${Object.entries(ROLE_CAPACITIES).map(([name,values])=>`WHEN ${quote(name)} THEN ARRAY[${values.map(quote).join(',')}]::text[]`).join(' ')} ELSE '{}'::text[] END`
const scopeBounds=(alias:string)=>`(${alias}.kind<>'supervisory' OR (
    jsonb_array_length(COALESCE(${alias}.scope->'unitIds','[]'))+jsonb_array_length(COALESCE(${alias}.scope->'territoryIds','[]'))+jsonb_array_length(COALESCE(${alias}.scope->'resourceIds','[]'))>0
    AND NOT(${alias}.powers && ARRAY['read_privileged','disclose_to_member','export_sealed_evidence','close','case:disclose_to_member','case:export_sealed_evidence','case:close'])))
  AND (${alias}.kind<>'governance_review' OR jsonb_array_length(COALESCE(${alias}.scope->'resourceIds','[]'))>0)
  AND (${alias}.kind<>'financial' OR (jsonb_array_length(COALESCE(${alias}.scope->'accountIds','[]'))>0
    AND (NOT(${alias}.powers && ARRAY['prepare','approve','execute']) OR (${alias}.monetary_limit_minor BETWEEN 0 AND 9007199254740991 AND length(btrim(${alias}.currency))>0))))
  AND (${alias}.kind<>'emergency_access' OR (${alias}.approved_by IS NOT NULL AND ${alias}.approved_by<>${alias}.principal_user_id
    AND length(btrim(${alias}.justification))>=20 AND ${alias}.expires_at<=${alias}.effective_at+interval '24 hours'
    AND jsonb_array_length(COALESCE(${alias}.scope->'resourceIds','[]'))>0 AND ${alias}.powers<@ARRAY['read','read_internal']))`
const liveMandate=(alias:string)=>`${alias}.organization_id=NEW.organization_id AND ${alias}.status='active' AND ${alias}.revoked_at IS NULL
  AND isfinite(${alias}.effective_at) AND isfinite(${alias}.expires_at) AND ${alias}.effective_at<=checked_at AND ${alias}.expires_at>checked_at
  AND ${alias}.expires_at>${alias}.effective_at AND length(btrim(${alias}.source_instrument))>0
  AND ${alias}.granted_by<>${alias}.principal_user_id AND cardinality(${alias}.powers)>0 AND array_position(${alias}.powers,NULL) IS NULL
  AND NOT EXISTS(SELECT FROM unnest(${alias}.powers) power WHERE power='' OR power<>btrim(power))
  AND public.ue_authority_scope_valid(${alias}.scope) AND ${scopeBounds(alias)}
  AND (NOT ${alias}.requires_acceptance OR EXISTS(SELECT FROM public.ue_authority_acceptances accepted
    WHERE accepted.organization_id=${alias}.organization_id AND accepted.instrument_type='mandate' AND accepted.instrument_id=${alias}.id
      AND accepted.accepted_by=${alias}.principal_user_id AND isfinite(accepted.accepted_at) AND accepted.accepted_at<=checked_at))`
const incompatible = INCOMPATIBLE_DUTIES.map(([a,b])=>`(${quote(a)}=ANY(NEW.powers) AND ${quote(b)}=ANY(NEW.powers)) OR EXISTS(
  SELECT FROM public.ue_authority_mandates m WHERE m.principal_user_id=holder AND m.kind='financial' AND ${liveMandate('m')}
    AND EXISTS(SELECT FROM jsonb_array_elements_text(NEW.scope->'accountIds') proposed(account)
      JOIN jsonb_array_elements_text(m.scope->'accountIds') held(account) USING(account))
    AND ((${quote(a)}=ANY(NEW.powers) AND ${quote(b)}=ANY(m.powers)) OR (${quote(b)}=ANY(NEW.powers) AND ${quote(a)}=ANY(m.powers))))`).join(' OR ')

export const AUTHORITY_ISSUER_BODY = `
#variable_conflict use_variable
DECLARE issuer text; holder text; dom text; r public.ue_authority_issuance_rules%ROWTYPE;
  issuer_role text; holder_role text; issuer_caps text[]; holder_caps text[]; holder_allowed text[];
  checked_at timestamptz; target uuid; req_id uuid; op text:='issue'; confers boolean:=true; reactivates boolean:=true; scoped record; confidential boolean; live_votes integer;
BEGIN
  -- Trusted fixture/bootstrap owners are not tenant principals. Runtime and system paths never inherit this exception.
  IF current_user='ue_v2_owner' OR EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
  confers:=TG_OP='INSERT';
  IF NOT confers THEN
    issuer:=NULLIF(current_setting('app.current_user_id',true),'');
    reactivates:=TG_TABLE_NAME='ue_authority_mandates' AND OLD.status='suspended' AND NEW.status='active';
    IF NEW.status='revoked' AND OLD.status<>'revoked' THEN op:='revoke';
    ELSIF TG_TABLE_NAME='ue_authority_mandates' AND ((OLD.status='active' AND NEW.status='suspended') OR reactivates) THEN op:='suspend';
    ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='ue_authority_resource_relationships' THEN
    IF confers AND (NEW.origin<>'explicit' OR NEW.relation NOT IN ('owner','assignee','collaborator') OR NEW.resource_type<>'case') THEN
      RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: persisted subject/derived authority is not a source' USING ERRCODE='42501'; END IF;
    IF confers THEN issuer:=NEW.granted_by; END IF;holder:=NEW.principal_user_id;dom:='case_assignment';target:=NEW.resource_id;
  ELSIF TG_TABLE_NAME='ue_authority_mandates' THEN
    IF confers THEN issuer:=NEW.granted_by; END IF;holder:=NEW.principal_user_id;dom:=NEW.kind;req_id:=NEW.approval_request_id;
    IF reactivates AND (NOT public.ue_authority_scope_valid(NEW.scope) OR array_position(NEW.powers,NULL) IS NOT NULL OR EXISTS(SELECT FROM unnest(NEW.powers) power WHERE power='' OR power<>btrim(power))) THEN RAISE EXCEPTION 'INSTRUMENT_INVALID: malformed mandate scope' USING ERRCODE='42501'; END IF;
  ELSE IF confers THEN issuer:=NEW.delegator_user_id; END IF;holder:=NEW.delegate_user_id;dom:='delegation';req_id:=NEW.approval_request_id; END IF;
  IF issuer IS NULL OR issuer IS DISTINCT FROM NULLIF(current_setting('app.current_user_id',true),'') OR (issuer=holder AND op<>'revoke')
    THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: authenticated independent issuer required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||person,0))
    FROM (SELECT DISTINCT person FROM unnest(ARRAY[issuer,holder]||COALESCE((SELECT array_agg(d.authority_line_user_id) FROM public.ue_authority_approval_decisions d WHERE d.organization_id=NEW.organization_id AND d.approval_request_id=req_id AND d.decision='approved'),'{}'::text[])) person ORDER BY person) people;
  IF target IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||target::text,0)); END IF;
  checked_at:=clock_timestamp();
  IF to_regprocedure('user_management.ue_authority_membership_rows(uuid,text[])') IS NULL THEN
    RAISE EXCEPTION 'ISSUER_AUTHORITY_UNAVAILABLE: canonical membership authority is required' USING ERRCODE='42501'; END IF;
  SELECT role INTO issuer_role FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[issuer])
    WHERE member_active AND user_active AND lifecycle_state='active';
  IF NOT FOUND OR (SELECT count(*) FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[issuer]))<>1 THEN
    RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: issuer is not a unique live canonical member' USING ERRCODE='42501'; END IF;
  SELECT role INTO holder_role FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[holder])
    WHERE member_active AND user_active AND lifecycle_state='active';
  IF reactivates AND (NOT FOUND OR (SELECT count(*) FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[holder]))<>1) THEN
    RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: holder is not a unique live canonical member' USING ERRCODE='42501'; END IF;
  issuer_caps:=${caps('issuer_role')};holder_caps:=${caps('holder_role')};
  IF confers THEN SELECT * INTO r FROM public.ue_authority_issuance_rules WHERE id=NEW.issuance_rule_id AND organization_id=NEW.organization_id;
  ELSE SELECT * INTO r FROM public.ue_authority_issuance_rules WHERE organization_id=NEW.organization_id AND domain=dom AND operation=op AND status='active'; END IF;
  IF NOT FOUND OR r.status<>'active' OR r.domain<>dom OR r.operation<>op
    OR (cardinality(r.issuer_capacities)>0 AND NOT (issuer_caps && r.issuer_capacities)) THEN
    RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: issuer is not eligible under this active institutional rule' USING ERRCODE='42501'; END IF;
  IF r.issuer_mandate_kind IS NOT NULL AND NOT EXISTS(SELECT FROM public.ue_authority_mandates m
    WHERE m.principal_user_id=issuer AND m.kind=r.issuer_mandate_kind AND r.issuer_mandate_power=ANY(m.powers) AND ${liveMandate('m')}) THEN
    RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: required issuing mandate is not live and accepted' USING ERRCODE='42501'; END IF;
  holder_allowed:=CASE dom WHEN 'case_assignment' THEN ARRAY['steward','chief_steward','officer'] WHEN 'supervisory' THEN ARRAY['chief_steward','officer','executive']
    WHEN 'executive_office' THEN ARRAY['executive'] WHEN 'governance_review' THEN ARRAY['member'] WHEN 'financial' THEN ARRAY['financial_officer','executive','trustee','auditor']
    WHEN 'emergency_access' THEN ARRAY['steward','chief_steward','officer','executive','financial_officer'] WHEN 'delegation' THEN ARRAY['officer','executive'] ELSE '{}'::text[] END;
  IF reactivates AND NOT (holder_caps && holder_allowed) THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: holder capacity is not eligible' USING ERRCODE='42501'; END IF;
  IF confers AND r.required_independent_approvals>0 THEN
    SELECT count(DISTINCT d.authority_line_user_id) INTO live_votes FROM public.ue_authority_approval_decisions d
      WHERE d.organization_id=NEW.organization_id AND d.approval_request_id=NEW.approval_request_id AND d.decision='approved'
        AND d.authority_line_user_id NOT IN(issuer,holder) AND d.approver_user_id NOT IN(issuer,holder)
        AND EXISTS(SELECT FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[d.authority_line_user_id]) member
          WHERE member.member_active AND member.user_active AND member.lifecycle_state='active');
    IF live_votes<r.required_independent_approvals THEN RAISE EXCEPTION 'APPROVAL_NOT_SATISFIED: recorded approving authority is no longer live' USING ERRCODE='42501'; END IF;
  END IF;
  IF dom='case_assignment' THEN
    SELECT s.id,s.claim_id,s.grievance_id,s.grievance_mirror_id,s.mirror_recorded_at,s.mirror_recorded_by,
      CASE WHEN u.organization_id=NEW.organization_id AND u.status::text='active' AND u.archived_at IS NULL THEN u.id END AS unit_id,
      CASE WHEN t.organization_id=NEW.organization_id AND t.retired_at IS NULL AND length(btrim(t.source_instrument))>0 THEN t.id END AS territory_id
      INTO scoped FROM public.case_authority_scopes s LEFT JOIN public.bargaining_units u ON u.id=s.unit_id
      LEFT JOIN public.case_territories t ON t.id=s.territory_id WHERE s.organization_id=NEW.organization_id AND s.case_id=target;
    PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||resource,0))
      FROM (SELECT DISTINCT resource FROM unnest(ARRAY[scoped.unit_id::text,scoped.territory_id::text]) resource WHERE resource IS NOT NULL ORDER BY resource) resources;
    SELECT s.id,s.claim_id,s.grievance_id,s.grievance_mirror_id,s.mirror_recorded_at,s.mirror_recorded_by,
      CASE WHEN u.organization_id=NEW.organization_id AND u.status::text='active' AND u.archived_at IS NULL THEN u.id END AS unit_id,
      CASE WHEN t.organization_id=NEW.organization_id AND t.retired_at IS NULL AND length(btrim(t.source_instrument))>0 THEN t.id END AS territory_id
      INTO scoped FROM public.case_authority_scopes s LEFT JOIN public.bargaining_units u ON u.id=s.unit_id
      LEFT JOIN public.case_territories t ON t.id=s.territory_id WHERE s.organization_id=NEW.organization_id AND s.case_id=target;
    checked_at:=clock_timestamp();
    IF NOT EXISTS(SELECT FROM user_management.ue_authority_membership_rows(NEW.organization_id,ARRAY[issuer]) member WHERE member.member_active AND member.user_active AND member.lifecycle_state='active') THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: session authority expired while waiting' USING ERRCODE='42501'; END IF;
    IF r.issuer_mandate_kind IS NOT NULL AND NOT EXISTS(SELECT FROM public.ue_authority_mandates m WHERE m.principal_user_id=issuer AND m.kind=r.issuer_mandate_kind AND r.issuer_mandate_power=ANY(m.powers) AND ${liveMandate('m')}) THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: issuing mandate expired while waiting' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT FROM public.claims WHERE organization_id=NEW.organization_id AND claim_id=target)
      AND EXISTS(SELECT FROM public.grievances WHERE organization_id=NEW.organization_id AND id=target)
      AND (scoped.id IS NULL OR scoped.claim_id IS DISTINCT FROM target OR scoped.grievance_mirror_id IS DISTINCT FROM target
        OR scoped.mirror_recorded_at IS NULL OR NOT isfinite(scoped.mirror_recorded_at) OR scoped.mirror_recorded_at>checked_at OR scoped.mirror_recorded_by IS NULL)
      THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: ambiguous case origin' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT FROM public.ue_authority_recusals WHERE organization_id=NEW.organization_id AND resource_type='case' AND resource_id=target
      AND (principal_user_id=issuer OR (reactivates AND principal_user_id=holder)) AND ${ACTIVE_RECUSAL_SQL.replaceAll('clock_timestamp()', 'checked_at')})
      OR EXISTS(SELECT FROM public.case_respondents WHERE organization_id=NEW.organization_id AND scope_id=scoped.id
        AND (respondent_user_id=issuer OR (reactivates AND respondent_user_id=holder)) AND ${ACTIVE_CASE_RESPONDENT_SQL.replaceAll('clock_timestamp()', 'checked_at')}) THEN
      RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: a conflicted issuer or holder cannot receive case authority' USING ERRCODE='42501'; END IF;
    SELECT COALESCE(is_confidential,false) INTO confidential FROM public.grievances WHERE organization_id=NEW.organization_id AND id=target;
    IF NOT FOUND THEN SELECT false INTO confidential FROM public.claims WHERE organization_id=NEW.organization_id AND claim_id=target;
      IF NOT FOUND THEN RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: case does not exist' USING ERRCODE='42501'; END IF; END IF;
    IF NOT(issuer_caps && ARRAY['chief_steward','officer','executive']) OR NOT EXISTS(
      SELECT FROM public.ue_authority_mandates m WHERE m.principal_user_id=issuer AND m.kind='supervisory' AND ${liveMandate('m')}
        AND 'assign'=ANY(m.powers) AND NOT ('read_privileged'=ANY(m.powers))
        AND NOT(m.powers && ARRAY['disclose_to_member','export_sealed_evidence','close','case:disclose_to_member','case:export_sealed_evidence','case:close'])
        AND (NOT confidential OR m.scope->>'classificationCeiling'='confidential')
        AND (m.scope->'resourceIds' ? target::text OR (scoped.unit_id IS NOT NULL AND m.scope->'unitIds' ? scoped.unit_id::text)
          OR (scoped.territory_id IS NOT NULL AND m.scope->'territoryIds' ? scoped.territory_id::text))) THEN
      RAISE EXCEPTION 'ISSUER_AUTHORITY_REQUIRED: issuer has no live scoped case:assign authority' USING ERRCODE='42501'; END IF;
  ELSIF TG_TABLE_NAME='ue_authority_mandates' AND reactivates THEN
    IF NOT confers AND (NEW.expires_at<=checked_at OR NOT isfinite(NEW.expires_at) OR NOT isfinite(NEW.effective_at)) THEN RAISE EXCEPTION 'INSTRUMENT_INVALID: expired or malformed mandate cannot resume' USING ERRCODE='42501'; END IF;
    IF dom='supervisory' AND (jsonb_array_length(COALESCE(NEW.scope->'unitIds','[]'))+jsonb_array_length(COALESCE(NEW.scope->'territoryIds','[]'))+jsonb_array_length(COALESCE(NEW.scope->'resourceIds','[]'))=0 OR 'read_privileged'=ANY(NEW.powers)) THEN
      RAISE EXCEPTION 'INSTRUMENT_INVALID: supervisory mandate has no valid bounded jurisdiction' USING ERRCODE='42501'; END IF;
    IF dom IN('governance_review','emergency_access') AND jsonb_array_length(COALESCE(NEW.scope->'resourceIds','[]'))=0 THEN RAISE EXCEPTION 'INSTRUMENT_INVALID: mandate must name exact resources' USING ERRCODE='42501'; END IF;
    IF dom='financial' THEN
      IF NEW.powers && ARRAY['prepare','approve','execute'] AND (NEW.monetary_limit_minor IS NULL OR NEW.monetary_limit_minor<0 OR NEW.monetary_limit_minor>9007199254740991 OR NEW.currency IS NULL OR length(btrim(NEW.currency))=0) THEN RAISE EXCEPTION 'INSTRUMENT_INVALID: safe monetary limit and currency required' USING ERRCODE='42501'; END IF;
      IF jsonb_array_length(COALESCE(NEW.scope->'accountIds','[]'))=0 THEN RAISE EXCEPTION 'INSTRUMENT_INVALID: financial mandate must name accounts' USING ERRCODE='42501'; END IF;
      IF ${incompatible} THEN RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: incompatible financial mandates' USING ERRCODE='42501'; END IF;
    END IF;
    IF confers AND dom='emergency_access' AND NOT EXISTS(SELECT FROM public.ue_authority_approval_decisions d WHERE d.organization_id=NEW.organization_id AND d.approval_request_id=NEW.approval_request_id AND d.decision='approved' AND d.authority_line_user_id=NEW.approved_by AND d.authority_line_user_id NOT IN(issuer,holder)) THEN RAISE EXCEPTION 'APPROVAL_NOT_SATISFIED: emergency approver must name its recorded independent authority line' USING ERRCODE='42501'; END IF;
    IF dom IN('executive_office','financial') AND EXISTS(SELECT FROM public.ue_authority_mandates m WHERE m.principal_user_id=holder AND m.kind='governance_review' AND ${liveMandate('m')}) THEN RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: operational office cannot coexist with independent oversight' USING ERRCODE='42501'; END IF;
    IF dom='governance_review' AND EXISTS(SELECT FROM public.ue_authority_mandates m WHERE m.principal_user_id=holder AND m.kind IN('executive_office','financial') AND ${liveMandate('m')}) THEN
      RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: independent oversight cannot be held with operational office' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
`
const trigger=(table:string)=>({table_name:table,name:'ue_authority_guard_issuer',function_name:'ue_authority_guard_issuer',tgtype:23,tgdeferrable:false,tginitdeferred:false,
  definition:`CREATE TRIGGER ue_authority_guard_issuer BEFORE INSERT OR UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.ue_authority_guard_issuer()`,args_hex:''})
export const AUTHORITY_ISSUER_GUARDS:PhysicalGuardContract={
  source:'apps/union-eyes/db/auth/authority-issuer-guards.ts',references:[],tables:['ue_authority_mandates','ue_authority_delegations','ue_authority_resource_relationships'],
  functions:[{name:'ue_authority_guard_issuer',body:AUTHORITY_ISSUER_BODY,returns:'trigger',args:'',volatility:'v',language:'plpgsql',path:'pg_catalog,public,pg_temp',callable:false}],constraints:[],
  triggers:['ue_authority_mandates','ue_authority_delegations','ue_authority_resource_relationships'].map(trigger),
}
