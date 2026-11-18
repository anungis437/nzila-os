/** Source-only institutional disclosure proof. No rule, office or vote is
 * installed or adopted here. Existing immutable authority stores remain the
 * source; a legacy active label and a citation/hash confer no entitlement. */
import { getTableConfig } from 'drizzle-orm/pg-core'
import { ueAuthorityIssuanceRules, ueAuthorityMandates, ueAuthorityApprovalRequests, ueAuthorityApprovalDecisions, ueAuthorityAcceptances, ueAuthorityEvents, ueAuthorityRecusals } from '../../db/schema/domains/ml/authority-kernel'
import { ROLE_CAPACITIES } from '../authority/capacity'
import { ACTIVE_CASE_RESPONDENT_SQL, ACTIVE_RECUSAL_SQL } from '../authority/common'
import { EXTERNAL_READ_AUTHORIZATION, EXTERNAL_READ_POWER } from './qualification'

export const EXTERNAL_INSTITUTIONAL_COLUMN_GRANTS = [ueAuthorityIssuanceRules, ueAuthorityMandates, ueAuthorityApprovalRequests, ueAuthorityApprovalDecisions, ueAuthorityAcceptances, ueAuthorityEvents, ueAuthorityRecusals]
  .map(table => ({ table: getTableConfig(table).name, select: getTableConfig(table).columns.map(column => column.name) }))
const columns = (table: string) => {
  const found = EXTERNAL_INSTITUTIONAL_COLUMN_GRANTS.find(entry => entry.table === table)
  if (!found) throw new Error('External institutional source table unavailable')
  return found.select.join(',')
}
const executiveRoles = Object.entries(ROLE_CAPACITIES).filter(([, capacities]) => capacities.includes('executive')).map(([role]) => `'${role}'`).join(',')
const actor = "NULLIF(current_setting('app.current_user_id',true),'')"
const saved = "prior_org text:=current_setting('ue.external_read_org',true);"
const restore = "PERFORM set_config('ue.external_read_org',COALESCE(prior_org,''),true);"

export const EXTERNAL_AUTHORITY_EVENT_BODY = `
BEGIN
  RETURN EXISTS(SELECT FROM public.ue_authority_events e JOIN public.audit_logs a ON a.organization_id=e.organization_id
    WHERE e.organization_id=row_org AND e.source_table=target_source_table AND e.source_id=target_source_id AND e.operation=target_operation
      AND e.row_after @> expected_after AND (expected_before IS NULL OR e.row_before @> expected_before)
      AND isfinite(e.occurred_at) AND isfinite(a.created_at) AND e.actor_user_id IS NOT NULL AND a.user_id=e.actor_user_id AND a.created_at>=e.occurred_at
      AND a.action LIKE 'authority.%' AND (a.details->'authorityEventIds') ? e.id::text
      AND a.details->>'authorityTxid'=e.txid::text
      AND a.content_hash=encode(sha256(convert_to(public.ue_external_read_json(jsonb_build_object(
        'action',a.action,'resource_type',a.resource_type,'resource_id',COALESCE(a.resource_id,''),'user_id',COALESCE(a.user_id,''),
        'correlation_id',COALESCE(a.correlation_id::text,''),'details',a.details,'previous_hash',COALESCE(a.previous_hash,''))),'UTF8')),'hex'));
END;
`

/** Count only immutable, independently cast, audited decisions, using the
 * request's stored threshold and generic risk floor. Issuance callers supply
 * their own independently stored minimum; disclosure never borrows that value. */
export const EXTERNAL_APPROVAL_VALID_BODY = `
DECLARE r record; votes integer;
BEGIN
  SELECT ${columns('ue_authority_approval_requests')} INTO r FROM public.ue_authority_approval_requests WHERE organization_id=row_org AND id=request_id;
  IF NOT FOUND OR r.status<>'satisfied' OR r.subject_type<>expected_subject_type OR r.subject_id<>expected_subject_id
    OR r.proposed_by<>proposer OR r.subject_author_id IS DISTINCT FROM author
    OR r.required_approvals>2147483647 OR r.required_approvals<greatest(minimum_votes,CASE WHEN r.risk_class IN('high','critical') THEN 2 ELSE 1 END)
    OR r.risk_class NOT IN('low','medium','high','critical') OR NOT isfinite(r.created_at) OR NOT isfinite(r.decided_at)
    OR r.decided_at<r.created_at OR r.decided_at>clock_timestamp()
    OR public.ue_external_authority_event_valid(row_org,'ue_authority_approval_requests',r.id,'INSERT',
      jsonb_build_object('subject_type',r.subject_type,'subject_id',r.subject_id,'proposed_by',r.proposed_by,
        'subject_author_id',r.subject_author_id,'required_approvals',r.required_approvals,'risk_class',r.risk_class,'status','open'),NULL) IS NOT TRUE
    THEN RETURN false; END IF;
  IF EXISTS(SELECT FROM public.ue_authority_approval_decisions d WHERE d.organization_id=row_org AND d.approval_request_id=r.id AND (
    d.decision<>'approved' OR d.delegation_id IS NOT NULL OR d.approver_user_id<>d.authority_line_user_id
    OR d.approver_user_id=proposer OR d.approver_user_id IS NOT DISTINCT FROM author
    OR d.approver_user_id=ANY(r.adverse_user_ids)
    OR (cardinality(r.named_approver_ids)>0 AND NOT(d.approver_user_id=ANY(r.named_approver_ids)))
    OR NOT isfinite(d.decided_at) OR d.decided_at<r.created_at OR d.decided_at>r.decided_at
    OR public.ue_external_authority_event_valid(row_org,'ue_authority_approval_decisions',d.id,'INSERT',to_jsonb(d),NULL) IS NOT TRUE)) THEN RETURN false; END IF;
  SELECT count(DISTINCT d.authority_line_user_id) INTO votes FROM public.ue_authority_approval_decisions d
    WHERE d.organization_id=row_org AND d.approval_request_id=r.id AND d.decision='approved'
      AND d.delegation_id IS NULL AND d.approver_user_id=d.authority_line_user_id
      AND d.approver_user_id<>proposer AND d.approver_user_id IS DISTINCT FROM author
      AND NOT(d.approver_user_id=ANY(r.adverse_user_ids))
      AND (cardinality(r.named_approver_ids)=0 OR d.approver_user_id=ANY(r.named_approver_ids))
      AND d.decided_at>=r.created_at AND d.decided_at<=r.decided_at
      AND public.ue_external_authority_event_valid(row_org,'ue_authority_approval_decisions',d.id,'INSERT',to_jsonb(d),NULL);
  RETURN votes>=r.required_approvals;
END;
`

export const EXTERNAL_OFFICE_VALID_BODY = `
DECLARE m record; r record; adoption record; accepted record; adopted boolean; checked_at timestamptz:=clock_timestamp();
BEGIN
  IF power !~ '^${EXTERNAL_READ_POWER.replaceAll('.', '[.]')}:(low|medium|high|critical):[1-9][0-9]*$'
    OR length(split_part(power,':',3))>10 THEN RETURN false; END IF;
  IF split_part(power,':',3)::numeric>2147483647
    OR (split_part(power,':',2) IN('high','critical') AND split_part(power,':',3)::numeric<2) THEN RETURN false; END IF;
  IF live_membership THEN
    IF ((SELECT count(*) FROM user_management.ue_authority_membership_rows(row_org,ARRAY[person]))<>1
    OR NOT EXISTS(SELECT FROM user_management.ue_authority_membership_rows(row_org,ARRAY[person])
      WHERE member_active AND user_active AND lifecycle_state='active' AND role=ANY(ARRAY[${executiveRoles}]))) THEN RETURN false; END IF;
  END IF;
  FOR m IN SELECT ${columns('ue_authority_mandates')} FROM public.ue_authority_mandates WHERE organization_id=row_org AND principal_user_id=person
    AND kind='executive_office' AND status='active' AND revoked_at IS NULL AND revoked_by IS NULL
    AND power=ANY(powers) AND 'approve'=ANY(powers) AND isfinite(effective_at) AND isfinite(expires_at)
    AND isfinite(created_at) AND isfinite(authorized_at) AND isfinite(until_at)
    AND effective_at<=checked_at AND effective_at<=authorized_at AND created_at<=authorized_at
    AND expires_at>checked_at AND expires_at>authorized_at AND expires_at>effective_at AND expires_at>=until_at
    AND requires_acceptance AND granted_by<>principal_user_id AND length(btrim(source_instrument))>0
    AND scope->'resourceIds'=jsonb_build_array(case_id::text)
    AND NOT EXISTS(SELECT FROM jsonb_object_keys(scope) key WHERE key<>'resourceIds')
  LOOP
    SELECT ${columns('ue_authority_issuance_rules')} INTO r FROM public.ue_authority_issuance_rules WHERE id=m.issuance_rule_id AND organization_id=row_org;
    IF NOT FOUND OR r.domain<>'executive_office' OR r.operation<>'issue' OR r.status<>'active' OR NOT r.requires_acceptance
      OR r.activated_at IS NULL OR NOT isfinite(r.activated_at) OR NOT isfinite(r.created_at) OR r.activated_at>authorized_at
      OR r.required_independent_approvals<0 OR r.required_independent_approvals>2147483647 OR r.version<1
      OR (r.max_term_days IS NOT NULL AND r.max_term_days<1)
      OR r.source_instrument='PENDING_INSTITUTIONAL_SOURCE' OR length(btrim(r.source_instrument))=0
      OR NOT(m.powers<@r.allowed_powers) OR (r.max_term_days IS NOT NULL AND m.expires_at-m.effective_at>make_interval(days=>r.max_term_days))
      OR public.ue_external_authority_event_valid(row_org,'ue_authority_issuance_rules',r.id,'UPDATE',
        to_jsonb(r),(to_jsonb(r)-ARRAY['status','approved_by','activated_at','retired_at'])||jsonb_build_object('status','draft')) IS NOT TRUE
      THEN CONTINUE; END IF;
    adopted:=false;
    FOR adoption IN SELECT ${columns('ue_authority_approval_requests')} FROM public.ue_authority_approval_requests WHERE organization_id=row_org AND subject_type='rule_adoption' AND subject_id=r.id LOOP
      IF public.ue_external_approval_valid(row_org,adoption.id,'rule_adoption',r.id,adoption.proposed_by,NULL,2)
        AND NOT(r.drafted_by=ANY(r.approved_by))
        AND (SELECT array_agg(d.authority_line_user_id::text ORDER BY d.authority_line_user_id::text) FROM public.ue_authority_approval_decisions d
          WHERE d.organization_id=row_org AND d.approval_request_id=adoption.id AND d.decision='approved')
          IS NOT DISTINCT FROM (SELECT array_agg(v::text ORDER BY v::text) FROM unnest(r.approved_by) v)
        THEN adopted:=true; EXIT; END IF;
    END LOOP;
    IF NOT adopted THEN CONTINUE; END IF;
    IF r.required_independent_approvals>0 AND public.ue_external_approval_valid(row_org,m.approval_request_id,
      'issuance:executive_office',m.id,m.granted_by,m.principal_user_id,r.required_independent_approvals) IS NOT TRUE THEN CONTINUE; END IF;
    IF NOT EXISTS(SELECT FROM public.ue_authority_events e WHERE e.organization_id=row_org AND e.source_table='ue_authority_mandates'
      AND e.source_id=m.id AND e.operation='INSERT' AND e.occurred_at<=authorized_at)
      OR public.ue_external_authority_event_valid(row_org,'ue_authority_mandates',m.id,'INSERT',
      to_jsonb(m)-ARRAY['status','revoked_at','revoked_by'],NULL) IS NOT TRUE THEN CONTINUE; END IF;
    SELECT ${columns('ue_authority_acceptances')} INTO accepted FROM public.ue_authority_acceptances WHERE organization_id=row_org AND instrument_type='mandate'
      AND instrument_id=m.id AND accepted_by=person AND isfinite(accepted_at) AND accepted_at<=checked_at AND accepted_at<=authorized_at;
    IF NOT FOUND OR public.ue_external_authority_event_valid(row_org,'ue_authority_acceptances',accepted.id,'INSERT',to_jsonb(accepted),NULL) IS NOT TRUE THEN CONTINUE; END IF;
    IF EXISTS(SELECT FROM public.ue_authority_recusals rc WHERE rc.organization_id=row_org AND rc.principal_user_id=person
      AND rc.resource_type='case' AND rc.resource_id=case_id AND ${ACTIVE_RECUSAL_SQL})
      OR EXISTS(SELECT FROM public.case_respondents respondent JOIN public.case_authority_scopes scoped ON scoped.id=respondent.scope_id AND scoped.organization_id=respondent.organization_id
        WHERE respondent.organization_id=row_org AND scoped.case_id=ue_external_office_valid.case_id AND respondent.respondent_user_id=person AND ${ACTIVE_CASE_RESPONDENT_SQL}) THEN CONTINUE; END IF;
    RETURN true;
  END LOOP;
  RETURN false;
END;
`

export const EXTERNAL_INSTITUTION_VALID_BODY = `
DECLARE r record; d record; checked_at timestamptz:=clock_timestamp(); row_org uuid:=(p->>'organizationId')::uuid;
  case_id uuid:=(p->'matter'->>'id')::uuid; power text; votes integer:=0;
BEGIN
  SELECT ${columns('ue_authority_approval_requests')} INTO r FROM public.ue_authority_approval_requests WHERE organization_id=row_org AND id=(p->>'institutionalApprovalId')::uuid;
  IF NOT FOUND OR r.subject_type IS DISTINCT FROM '${EXTERNAL_READ_AUTHORIZATION}:'||encode(sha256(convert_to(public.ue_external_read_json(p),'UTF8')),'hex')
    OR r.subject_id<>case_id OR r.proposed_by<>p->>'issuerUserId' OR r.subject_author_id IS DISTINCT FROM p->>'representedMemberUserId'
    OR NOT(p->>'representativeUserId'=ANY(r.adverse_user_ids))
    OR public.ue_external_approval_valid(row_org,r.id,r.subject_type,case_id,r.proposed_by,r.subject_author_id,1) IS NOT TRUE THEN RETURN false; END IF;
  power:='${EXTERNAL_READ_POWER}:'||r.risk_class||':'||r.required_approvals::text;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||person,0))
    FROM (SELECT DISTINCT approver_user_id::text AS person FROM public.ue_authority_approval_decisions
      WHERE organization_id=row_org AND approval_request_id=r.id ORDER BY person) people;
  FOR d IN SELECT ${columns('ue_authority_approval_decisions')} FROM public.ue_authority_approval_decisions WHERE organization_id=row_org AND approval_request_id=r.id LOOP
    IF d.decision<>'approved' OR NOT isfinite(d.decided_at) OR d.decided_at<r.created_at OR d.decided_at>r.decided_at
      OR d.approver_user_id=ANY(r.adverse_user_ids)
      OR (cardinality(r.named_approver_ids)>0 AND NOT(d.approver_user_id=ANY(r.named_approver_ids)))
      OR d.approver_user_id IN(p->>'representativeUserId',p->>'representedMemberUserId',p->>'issuerUserId')
      OR d.delegation_id IS NOT NULL OR d.authority_line_user_id<>d.approver_user_id
      OR (NOT live_membership AND public.ue_external_authorizer_live_v1(row_org,r.id,d.approver_user_id) IS NOT TRUE)
      OR public.ue_external_office_valid(row_org,case_id,d.approver_user_id,power,d.decided_at,(p->>'expiresAt')::timestamptz,live_membership) IS NOT TRUE
      OR public.ue_external_authority_event_valid(row_org,'ue_authority_approval_decisions',d.id,'INSERT',to_jsonb(d),NULL) IS NOT TRUE THEN RETURN false; END IF;
    votes:=votes+1;
  END LOOP;
  RETURN votes>=r.required_approvals;
END;
`

/** This is the bounded relation proof for the auth-owned boolean only. It
 * never opens auth storage and never calls institution_valid (no recursion).
 * The auth function separately proves the original recipient's live session. */
export const EXTERNAL_AUTHORIZER_SCOPE_BODY = `
DECLARE permitted boolean:=false; checked_at timestamptz:=clock_timestamp(); ${saved}
BEGIN
  PERFORM set_config('ue.external_read_org',target_org::text,true);
  SELECT EXISTS(SELECT FROM public.ue_external_read_qualifications q JOIN public.ue_external_read_consents c ON c.id=q.consent_id
    JOIN public.ue_authority_approval_requests r ON r.organization_id=q.organization_id AND r.id=(q.payload->>'institutionalApprovalId')::uuid
    JOIN public.ue_authority_approval_decisions d ON d.organization_id=r.organization_id AND d.approval_request_id=r.id
    WHERE q.organization_id=target_org AND r.id=approved_request_id AND q.recipient_user_id=${actor}
      AND q.representative_organization_id::text=NULLIF(current_setting('app.current_org_id',true),'')
      AND q.revoked_at IS NULL AND q.revoked_by IS NULL AND q.effective_at<=checked_at AND q.expires_at>checked_at
      AND isfinite(q.effective_at) AND isfinite(q.expires_at) AND q.payload_hash=c.payload_hash
      AND c.organization_id=q.organization_id AND c.matter_id=q.matter_id AND c.member_user_id=q.member_user_id
      AND c.recipient_user_id=q.recipient_user_id AND c.representative_organization_id=q.representative_organization_id
      AND c.revoked_at IS NULL AND c.revoked_by IS NULL AND isfinite(c.effective_at) AND isfinite(c.expires_at)
      AND c.effective_at<=checked_at AND c.expires_at>checked_at
      AND q.payload_hash=encode(sha256(convert_to(public.ue_external_read_json(q.payload),'UTF8')),'hex')
      AND r.subject_type='${EXTERNAL_READ_AUTHORIZATION}:'||q.payload_hash AND r.subject_id=q.matter_id
      AND r.proposed_by=q.qualified_by AND r.subject_author_id=q.member_user_id
      AND d.approver_user_id=authorizer_id AND d.authority_line_user_id=authorizer_id AND d.decision='approved' AND d.delegation_id IS NULL
      AND public.ue_external_approval_valid(target_org,r.id,r.subject_type,r.subject_id,r.proposed_by,r.subject_author_id,1)
      AND public.ue_external_sources_match(q.payload)) INTO permitted;
  ${restore} RETURN permitted IS TRUE;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

export const EXTERNAL_APPROVAL_GUARD_BODY = `
DECLARE r record; row_org uuid:=NEW.organization_id; case_id uuid; ${saved}
BEGIN
  PERFORM set_config('ue.external_read_org',row_org::text,true);
  IF TG_TABLE_NAME='ue_authority_approval_requests' THEN
    IF NEW.subject_type NOT LIKE '${EXTERNAL_READ_AUTHORIZATION}%' THEN ${restore} RETURN NEW; END IF;
    case_id:=NEW.subject_id;
    IF NEW.subject_type !~ '^${EXTERNAL_READ_AUTHORIZATION}:[a-f0-9]{64}$' OR NEW.proposed_by IS DISTINCT FROM ${actor}
      OR user_management.auth_business_org_authorized(row_org,NULL::text[]) IS NOT TRUE
      OR public.ue_case_domain_authorized(row_org,case_id,'case:disclose_to_member') IS NOT TRUE
      OR NOT EXISTS(SELECT FROM public.grievances WHERE organization_id=row_org AND id=case_id
        AND represented_member_user_id=NEW.subject_author_id AND grievant_id::text=represented_member_user_id)
      THEN RAISE EXCEPTION 'EXTERNAL_APPROVAL_REQUEST_SOURCE_REQUIRED' USING ERRCODE='42501'; END IF;
  ELSE
    SELECT ${columns('ue_authority_approval_requests')} INTO r FROM public.ue_authority_approval_requests WHERE organization_id=row_org AND id=NEW.approval_request_id;
    IF NOT FOUND OR r.subject_type NOT LIKE '${EXTERNAL_READ_AUTHORIZATION}%' THEN ${restore} RETURN NEW; END IF;
    case_id:=r.subject_id;
    IF r.subject_type !~ '^${EXTERNAL_READ_AUTHORIZATION}:[a-f0-9]{64}$' OR NEW.approver_user_id IS DISTINCT FROM ${actor}
      OR NEW.authority_line_user_id IS DISTINCT FROM NEW.approver_user_id OR NEW.delegation_id IS NOT NULL
      OR NEW.approver_user_id=ANY(r.adverse_user_ids) OR NEW.approver_user_id IN(r.proposed_by,r.subject_author_id)
      OR user_management.auth_business_org_authorized(row_org,ARRAY[${executiveRoles}]) IS NOT TRUE
      OR public.ue_external_office_valid(row_org,case_id,NEW.approver_user_id,
        '${EXTERNAL_READ_POWER}:'||r.risk_class||':'||r.required_approvals::text,NEW.decided_at,clock_timestamp(),true) IS NOT TRUE
      THEN RAISE EXCEPTION 'EXPLICIT_EXTERNAL_OFFICE_AUTHORIZATION_REQUIRED' USING ERRCODE='42501'; END IF;
  END IF;
  ${restore} RETURN NEW;
EXCEPTION WHEN OTHERS THEN ${restore} RAISE;
END;
`

/** The organization lock exists before the first qualification is visible.
 * It therefore also covers a concurrent source writer whose statement snapshot
 * predates qualification creation; a census of existing grant rows cannot. */
export const EXTERNAL_INSTITUTION_LOCK_BODY = `
DECLARE row_org uuid:=CASE WHEN TG_OP='INSERT' THEN NEW.organization_id ELSE OLD.organization_id END;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-read-institution:'||row_org::text,0));
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
`
