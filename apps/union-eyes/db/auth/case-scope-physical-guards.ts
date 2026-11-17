/** Current source-owned B002 protections. Prospective/forward-additive installation; no live backfill. */
import type { PhysicalGuardContract } from './physical-guard-catalog';
import { ACTIVE_RECUSAL_SQL } from '@/lib/authority/common';
import { ROLE_CAPACITIES } from '@/lib/authority/capacity';

const eligibility = Object.entries(ROLE_CAPACITIES).map(([role, capacities]) =>
  `(user_management.auth_business_org_authorized(row_org,ARRAY['${role}']::text[]) AND r.issuer_capacities && ARRAY[${capacities.map(c => `'${c}'`).join(',')}]::text[])`).join(' OR ');
const liveMandate = (alias: string) => `${alias}.status='active' AND ${alias}.revoked_at IS NULL
  AND isfinite(${alias}.effective_at) AND isfinite(${alias}.expires_at) AND ${alias}.effective_at<=now() AND ${alias}.expires_at>now()
  AND (NOT ${alias}.requires_acceptance OR EXISTS(SELECT FROM ue_authority_acceptances a WHERE a.organization_id=${alias}.organization_id
    AND a.instrument_type='mandate' AND a.instrument_id=${alias}.id AND a.accepted_by=${alias}.principal_user_id
    AND isfinite(a.accepted_at) AND a.accepted_at<=now()))`;
const draftRoles = Object.entries(ROLE_CAPACITIES).filter(([, capacities]) => capacities.some(c => c === 'steward' || c === 'officer' || c === 'chief_steward')).map(([role]) => `'${role}'`).join(',');
const supervisorRoles = Object.entries(ROLE_CAPACITIES).filter(([, capacities]) => capacities.some(c => c === 'officer' || c === 'chief_steward' || c === 'executive')).map(([role]) => `'${role}'`).join(',');
const executiveRoles = Object.entries(ROLE_CAPACITIES).filter(([, capacities]) => capacities.includes('executive')).map(([role]) => `'${role}'`).join(',');
const draftAuthorized = `
 SELECT user_management.auth_business_org_authorized(row_org,ARRAY[${draftRoles}]::text[])
 AND EXISTS(SELECT FROM ue_authority_resource_relationships rr WHERE rr.organization_id=row_org AND rr.resource_type='case' AND rr.resource_id=row_case
   AND rr.principal_user_id=current_setting('app.current_user_id',true) AND rr.status='active' AND rr.revoked_at IS NULL
   AND isfinite(rr.effective_at) AND rr.effective_at<=now() AND (rr.expires_at IS NULL OR (isfinite(rr.expires_at) AND rr.expires_at>now()))
   AND (rr.relation IN ('owner','assignee') OR (rr.relation='collaborator' AND rr.origin='explicit' AND rr.granted_by IS NOT NULL
     AND rr.granted_by<>rr.principal_user_id AND 'draft_action'=ANY(rr.permissions))))
 AND NOT EXISTS(SELECT FROM ue_authority_recusals WHERE organization_id=row_org AND resource_type='case' AND resource_id=row_case
   AND principal_user_id=current_setting('app.current_user_id',true) AND ${ACTIVE_RECUSAL_SQL})
 AND NOT EXISTS(SELECT FROM case_respondents p JOIN case_authority_scopes s ON s.id=p.scope_id AND s.organization_id=p.organization_id
   WHERE s.organization_id=row_org AND s.case_id=row_case AND p.revoked_at IS NULL AND p.respondent_user_id=current_setting('app.current_user_id',true))
`;
const authorized = `
 SELECT user_management.auth_business_org_authorized(row_org,ARRAY[${supervisorRoles}]::text[])
 AND EXISTS(SELECT FROM ue_authority_issuance_rules r WHERE r.id=rule_id AND r.organization_id=row_org
   AND r.domain='case_assignment' AND r.operation='amend' AND r.status='active' AND 'scope'=ANY(r.allowed_powers)
   AND btrim(r.source_instrument)<>'' AND r.source_instrument<>'PENDING_INSTITUTIONAL_SOURCE'
   AND (${eligibility})
   AND (r.issuer_mandate_kind IS NULL OR EXISTS(SELECT FROM ue_authority_mandates im WHERE im.organization_id=row_org
     AND im.principal_user_id=current_setting('app.current_user_id',true) AND im.kind=r.issuer_mandate_kind
     AND r.issuer_mandate_power=ANY(im.powers) AND ${liveMandate('im')})))
 AND EXISTS(SELECT FROM ue_authority_mandates m WHERE m.organization_id=row_org
   AND m.principal_user_id=current_setting('app.current_user_id',true) AND m.kind='supervisory'
   AND 'assign'=ANY(m.powers) AND (m.scope->'resourceIds') ? row_case::text AND ${liveMandate('m')}
   AND btrim(m.source_instrument)<>'' AND m.source_instrument<>'PENDING_INSTITUTIONAL_SOURCE')
 AND NOT EXISTS(SELECT FROM ue_authority_recusals WHERE organization_id=row_org AND resource_type='case' AND resource_id=row_case
   AND principal_user_id=current_setting('app.current_user_id',true) AND ${ACTIVE_RECUSAL_SQL})
 AND NOT EXISTS(SELECT FROM case_respondents p JOIN case_authority_scopes s ON s.id=p.scope_id AND s.organization_id=p.organization_id
   WHERE s.organization_id=row_org AND s.case_id=row_case AND p.revoked_at IS NULL
   AND p.respondent_user_id=current_setting('app.current_user_id',true))
`;
const guard = `
DECLARE
 actor text := nullif(current_setting('app.current_user_id',true),'');
 p case_scope_proposals%ROWTYPE; s case_authority_scopes%ROWTYPE;
 ar ue_authority_approval_requests%ROWTYPE; r ue_authority_issuance_rules%ROWTYPE;
 proposal uuid; allowed_lines integer; logical_case uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CASE_SCOPE_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='case_authority_scopes' THEN logical_case:=NEW.case_id;
 ELSE SELECT case_id INTO logical_case FROM case_authority_scopes WHERE id=NEW.scope_id AND organization_id=NEW.organization_id;
 END IF;
 IF logical_case IS NULL THEN RAISE EXCEPTION 'EXACT_CASE_SCOPE_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||logical_case::text,0));
 IF actor IS NULL OR NOT user_management.auth_business_org_authorized(NEW.organization_id,NULL::text[]) THEN
   RAISE EXCEPTION 'LIVE_CANONICAL_CASE_SCOPE_ACTOR_REQUIRED' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='case_authority_scopes' AND TG_OP='INSERT' THEN
   IF NEW.unit_id IS NOT NULL OR NEW.territory_id IS NOT NULL OR NEW.revision<>0 OR NEW.last_proposal_id IS NOT NULL
     OR NEW.grievance_mirror_id IS NOT NULL OR NEW.mirror_recorded_at IS NOT NULL OR NEW.mirror_recorded_by IS NOT NULL THEN
     RAISE EXCEPTION 'INITIAL_CASE_SCOPE_MUST_BE_UNKNOWN' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT FROM claims c JOIN grievances g ON g.id=c.claim_id AND g.organization_id=c.organization_id
     WHERE c.organization_id=NEW.organization_id AND c.claim_id=NEW.case_id) THEN
     RAISE EXCEPTION 'AMBIGUOUS_CANONICAL_CASE_PARENT' USING ERRCODE='42501'; END IF;
   RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='case_authority_scopes' AND TG_OP='UPDATE' THEN
  IF NEW.grievance_mirror_id IS DISTINCT FROM OLD.grievance_mirror_id OR NEW.mirror_recorded_at IS DISTINCT FROM OLD.mirror_recorded_at
   OR NEW.mirror_recorded_by IS DISTINCT FROM OLD.mirror_recorded_by THEN
   IF OLD.grievance_mirror_id IS NOT NULL OR OLD.claim_id IS NULL OR OLD.grievance_id IS NOT NULL
     OR NEW.grievance_mirror_id IS DISTINCT FROM OLD.case_id OR NEW.mirror_recorded_by IS DISTINCT FROM actor
     OR NEW.mirror_recorded_at IS NULL OR NOT isfinite(NEW.mirror_recorded_at) OR NEW.mirror_recorded_at>now()
     OR (to_jsonb(NEW)-ARRAY['grievance_mirror_id','mirror_recorded_at','mirror_recorded_by','updated_at']) IS DISTINCT FROM
        (to_jsonb(OLD)-ARRAY['grievance_mirror_id','mirror_recorded_at','mirror_recorded_by','updated_at'])
     OR NOT ue_case_scope_draft_authorized(OLD.organization_id,OLD.case_id)
     OR NOT EXISTS(SELECT FROM claims c JOIN grievances g ON g.organization_id=c.organization_id AND g.id=c.claim_id
       WHERE c.organization_id=OLD.organization_id AND c.claim_id=OLD.claim_id AND g.created_by=actor
         AND g.represented_member_user_id=c.member_id AND (g.grievant_id IS NULL OR g.grievant_id::text=c.member_id)) THEN
     RAISE EXCEPTION 'CANONICAL_GRIEVANCE_MIRROR_REQUIRED' USING ERRCODE='42501'; END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF TG_TABLE_NAME='case_scope_proposals' THEN
   IF TG_OP='INSERT' THEN
     SELECT * INTO s FROM case_authority_scopes WHERE id=NEW.scope_id AND organization_id=NEW.organization_id FOR UPDATE;
     IF NOT FOUND OR NEW.expected_revision<>s.revision OR NEW.proposed_by IS DISTINCT FROM actor OR NEW.applied_at IS NOT NULL OR NEW.applied_by IS NOT NULL
       OR NOT ue_case_scope_amendment_authorized(NEW.organization_id,s.case_id,NEW.issuance_rule_id) THEN
       RAISE EXCEPTION 'CASE_SCOPE_PROPOSAL_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
     IF cardinality(NEW.respondent_user_ids)>200 OR actor=ANY(NEW.respondent_user_ids)
       OR cardinality(NEW.respondent_user_ids)<>(SELECT count(DISTINCT x) FROM unnest(NEW.respondent_user_ids) x)
       OR EXISTS(SELECT FROM unnest(NEW.respondent_user_ids) x WHERE x IS NULL OR length(x) NOT BETWEEN 1 AND 255 OR x<>btrim(x) OR x ~ '[[:cntrl:]]') THEN
       RAISE EXCEPTION 'INVALID_CASE_RESPONDENTS' USING ERRCODE='42501'; END IF;
     SELECT * INTO ar FROM ue_authority_approval_requests WHERE id=NEW.approval_request_id AND organization_id=NEW.organization_id FOR UPDATE;
     SELECT * INTO r FROM ue_authority_issuance_rules WHERE id=NEW.issuance_rule_id AND organization_id=NEW.organization_id FOR SHARE;
     IF ar.id IS NULL OR ar.subject_type<>'case_scope' OR ar.subject_id<>NEW.id OR ar.proposed_by<>actor OR ar.status<>'open'
       OR ar.required_approvals<greatest(2,r.required_independent_approvals) OR ar.risk_class NOT IN ('high','critical')
       OR EXISTS(SELECT FROM ue_authority_approval_decisions WHERE approval_request_id=ar.id)
       OR NOT (NEW.respondent_user_ids::text[] <@ ar.adverse_user_ids::text[])
       OR EXISTS(SELECT FROM case_respondents cp WHERE cp.organization_id=NEW.organization_id AND cp.scope_id=s.id AND cp.revoked_at IS NULL
           AND NOT cp.respondent_user_id=ANY(ar.adverse_user_ids)) THEN
       RAISE EXCEPTION 'EXACT_UNVOTED_SCOPE_APPROVAL_REQUIRED' USING ERRCODE='42501'; END IF;
     RETURN NEW;
   END IF;
   IF OLD.applied_at IS NOT NULL OR (to_jsonb(NEW)-ARRAY['applied_at','applied_by','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['applied_at','applied_by','updated_at'])
     OR NEW.applied_by IS DISTINCT FROM actor OR NEW.applied_at IS NULL OR NOT isfinite(NEW.applied_at) OR NEW.applied_at>now() THEN
     RAISE EXCEPTION 'CASE_SCOPE_PROPOSAL_IMMUTABLE' USING ERRCODE='42501'; END IF;
   proposal:=NEW.id;
 ELSIF TG_TABLE_NAME='case_authority_scopes' THEN
   IF (to_jsonb(NEW)-ARRAY['unit_id','territory_id','revision','last_proposal_id','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['unit_id','territory_id','revision','last_proposal_id','updated_at']) OR NEW.revision<>OLD.revision+1 THEN
     RAISE EXCEPTION 'CASE_SCOPE_PARENT_IMMUTABLE' USING ERRCODE='42501'; END IF;
   proposal:=NEW.last_proposal_id;
 ELSE
   IF TG_OP='INSERT' THEN
     IF NEW.recorded_by IS DISTINCT FROM actor OR NEW.revoked_at IS NOT NULL OR NEW.revoked_by IS NOT NULL OR NEW.revoked_proposal_id IS NOT NULL
       OR NOT isfinite(NEW.recorded_at) OR NEW.recorded_at>now() THEN RAISE EXCEPTION 'INVALID_CASE_RESPONDENT_ACTOR' USING ERRCODE='42501'; END IF;
     proposal:=NEW.proposal_id;
   ELSE
     IF OLD.revoked_at IS NOT NULL OR (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by','revoked_proposal_id','updated_at']) IS DISTINCT FROM
        (to_jsonb(OLD)-ARRAY['revoked_at','revoked_by','revoked_proposal_id','updated_at']) OR NEW.revoked_by IS DISTINCT FROM actor
        OR NEW.revoked_at IS NULL OR NOT isfinite(NEW.revoked_at) OR NEW.revoked_at<NEW.recorded_at OR NEW.revoked_at>now() THEN
       RAISE EXCEPTION 'CASE_RESPONDENT_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END IF;
     proposal:=NEW.revoked_proposal_id;
   END IF;
 END IF;
 SELECT * INTO p FROM case_scope_proposals WHERE id=proposal AND organization_id=NEW.organization_id FOR UPDATE;
 SELECT * INTO s FROM case_authority_scopes WHERE id=p.scope_id AND organization_id=p.organization_id FOR UPDATE;
 SELECT * INTO r FROM ue_authority_issuance_rules WHERE id=p.issuance_rule_id AND organization_id=p.organization_id FOR SHARE;
 SELECT * INTO ar FROM ue_authority_approval_requests WHERE id=p.approval_request_id AND organization_id=p.organization_id FOR SHARE;
 IF p.id IS NULL OR p.applied_at IS NOT NULL OR s.id IS NULL OR ar.status<>'satisfied' OR ar.subject_type<>'case_scope' OR ar.subject_id<>p.id
   OR ar.proposed_by<>p.proposed_by OR ar.required_approvals<greatest(2,r.required_independent_approvals)
   OR NOT ue_case_scope_amendment_authorized(p.organization_id,s.case_id,p.issuance_rule_id) OR actor=ANY(p.respondent_user_ids) THEN
   RAISE EXCEPTION 'LIVE_EXACT_SCOPE_APPROVAL_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT count(DISTINCT d.authority_line_user_id) INTO allowed_lines FROM ue_authority_approval_decisions d
   JOIN LATERAL user_management.ue_authority_membership_rows(p.organization_id,ARRAY[d.authority_line_user_id::text]) u
     ON u.user_id=d.authority_line_user_id AND u.member_active AND u.user_active AND u.lifecycle_state='active' AND u.role IN (${executiveRoles})
   WHERE d.approval_request_id=ar.id AND d.decision='approved' AND d.delegation_id IS NULL AND d.approver_user_id=d.authority_line_user_id
     AND d.authority_line_user_id NOT IN (p.proposed_by,actor) AND NOT d.authority_line_user_id=ANY(p.respondent_user_ids)
     AND NOT EXISTS(SELECT FROM ue_authority_recusals WHERE organization_id=p.organization_id AND resource_type='approval_request' AND resource_id=ar.id
       AND principal_user_id=d.authority_line_user_id AND ${ACTIVE_RECUSAL_SQL})
     AND NOT EXISTS(SELECT FROM ue_authority_recusals WHERE organization_id=p.organization_id AND resource_type='case' AND resource_id=s.case_id
       AND principal_user_id=d.authority_line_user_id AND ${ACTIVE_RECUSAL_SQL});
 IF allowed_lines<greatest(2,r.required_independent_approvals) THEN RAISE EXCEPTION 'LIVE_INDEPENDENT_SCOPE_APPROVAL_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p.unit_id IS NOT NULL AND NOT EXISTS(SELECT FROM bargaining_units WHERE id=p.unit_id AND organization_id=p.organization_id AND status='active') THEN
   RAISE EXCEPTION 'CASE_SCOPE_UNIT_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
 IF p.territory_id IS NOT NULL AND NOT EXISTS(SELECT FROM case_territories WHERE id=p.territory_id AND organization_id=p.organization_id AND retired_at IS NULL) THEN
   RAISE EXCEPTION 'CASE_SCOPE_TERRITORY_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='case_authority_scopes' THEN
   IF p.scope_id<>NEW.id OR p.expected_revision<>OLD.revision OR NEW.unit_id IS DISTINCT FROM p.unit_id OR NEW.territory_id IS DISTINCT FROM p.territory_id THEN
     RAISE EXCEPTION 'SUBSTITUTED_CASE_SCOPE_SNAPSHOT' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='case_respondents' THEN
   IF p.scope_id<>NEW.scope_id OR s.revision<>p.expected_revision+1 OR s.last_proposal_id<>p.id
     OR (TG_OP='INSERT' AND NOT NEW.respondent_user_id=ANY(p.respondent_user_ids))
     OR (TG_OP='UPDATE' AND NEW.respondent_user_id=ANY(p.respondent_user_ids)) THEN
     RAISE EXCEPTION 'SUBSTITUTED_CASE_RESPONDENT' USING ERRCODE='42501'; END IF;
 ELSE
   IF s.revision<>p.expected_revision+1 OR s.last_proposal_id<>p.id OR s.unit_id IS DISTINCT FROM p.unit_id OR s.territory_id IS DISTINCT FROM p.territory_id
     OR (SELECT coalesce(array_agg(respondent_user_id::text ORDER BY respondent_user_id::text),ARRAY[]::text[]) FROM case_respondents
       WHERE scope_id=s.id AND organization_id=s.organization_id AND revoked_at IS NULL)
       IS DISTINCT FROM (SELECT coalesce(array_agg(x::text ORDER BY x::text),ARRAY[]::text[]) FROM unnest(p.respondent_user_ids) x) THEN
     RAISE EXCEPTION 'INCOMPLETE_CASE_SCOPE_AMENDMENT' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END;
`;
const audit = `
DECLARE proposal uuid; s case_authority_scopes%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='case_scope_proposals' AND TG_OP='INSERT' THEN
   IF NOT EXISTS(SELECT FROM audit_logs a JOIN case_authority_scopes cs ON cs.organization_id=NEW.organization_id AND cs.id=NEW.scope_id
     WHERE a.organization_id=NEW.organization_id AND a.action='case.scope.proposed' AND a.resource_id=cs.case_id::text
       AND a.details->>'caseScopeProposalId'=NEW.id::text AND a.user_id=NEW.proposed_by AND a.created_at>=NEW.created_at) THEN
     RAISE EXCEPTION 'CASE_SCOPE_PROPOSAL_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
   RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='case_authority_scopes' AND TG_OP='INSERT' THEN
   IF NOT EXISTS(SELECT FROM audit_logs WHERE organization_id=NEW.organization_id AND action='case.scope.parent_bound'
     AND resource_id=NEW.case_id::text AND details->>'scopeId'=NEW.id::text AND user_id=current_setting('app.current_user_id',true)) THEN
     RAISE EXCEPTION 'CASE_SCOPE_PARENT_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
   RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='case_authority_scopes' AND TG_OP='UPDATE' THEN
  IF NEW.grievance_mirror_id IS DISTINCT FROM OLD.grievance_mirror_id THEN
   IF NOT EXISTS(SELECT FROM audit_logs WHERE organization_id=NEW.organization_id AND action='case.scope.mirror_bound'
     AND resource_id=NEW.case_id::text AND details->>'scopeId'=NEW.id::text AND user_id=NEW.mirror_recorded_by AND created_at>=NEW.mirror_recorded_at) THEN
     RAISE EXCEPTION 'CASE_SCOPE_MIRROR_AUDIT_REQUIRED' USING ERRCODE='23514'; END IF;
   RETURN NULL;
  END IF;
 END IF;
 IF TG_TABLE_NAME='case_authority_scopes' THEN proposal:=NEW.last_proposal_id;
 ELSIF TG_TABLE_NAME='case_scope_proposals' THEN proposal:=NEW.id;
 ELSE proposal:=CASE WHEN TG_OP='INSERT' THEN NEW.proposal_id ELSE NEW.revoked_proposal_id END;
 END IF;
 IF NOT EXISTS(SELECT FROM case_scope_proposals p JOIN case_authority_scopes cs ON cs.id=p.scope_id AND cs.organization_id=p.organization_id
   JOIN audit_logs a ON a.organization_id=p.organization_id AND a.action='case.scope.amended' AND a.resource_id=cs.case_id::text
     AND a.details->>'caseScopeProposalId'=p.id::text AND a.user_id=p.applied_by AND a.created_at>=p.applied_at
   WHERE p.organization_id=NEW.organization_id AND p.id=proposal AND p.applied_at IS NOT NULL AND isfinite(p.applied_at)
     AND cs.last_proposal_id=p.id AND cs.revision=p.expected_revision+1
     AND ue_case_scope_amendment_authorized(p.organization_id,cs.case_id,p.issuance_rule_id)) THEN
   RAISE EXCEPTION 'CASE_SCOPE_ATOMIC_AUDIT_AND_SETTLEMENT_REQUIRED' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
`;
const parentGuard = `
DECLARE linked boolean; logical_case uuid;
BEGIN
 IF TG_OP='INSERT' THEN
   IF TG_TABLE_NAME='claims' THEN
     IF EXISTS(SELECT FROM grievances WHERE organization_id=NEW.organization_id AND id=NEW.claim_id) THEN
       RAISE EXCEPTION 'CANONICAL_CASE_ID_ALREADY_GRIEVANCE' USING ERRCODE='42501'; END IF;
   ELSE
     IF EXISTS(SELECT FROM claims WHERE organization_id=NEW.organization_id AND claim_id=NEW.id) THEN
       PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||NEW.id::text,0));
       IF NOT EXISTS(SELECT FROM case_authority_scopes s JOIN claims c ON c.organization_id=s.organization_id AND c.claim_id=s.claim_id
         WHERE s.organization_id=NEW.organization_id AND s.case_id=NEW.id AND s.claim_id=NEW.id AND s.grievance_id IS NULL
           AND s.grievance_mirror_id IS NULL AND c.member_id=NEW.represented_member_user_id
           AND (NEW.grievant_id IS NULL OR NEW.grievant_id::text=c.member_id)
           AND NEW.created_by=current_setting('app.current_user_id',true) AND ue_case_scope_draft_authorized(s.organization_id,s.case_id)) THEN
         RAISE EXCEPTION 'PROTECTED_CLAIM_ESCALATION_PROVENANCE_REQUIRED' USING ERRCODE='42501'; END IF;
     END IF;
   END IF;
   RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='claims' THEN logical_case:=OLD.claim_id; ELSE logical_case:=OLD.id; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||logical_case::text,0));
 IF TG_TABLE_NAME='claims' THEN
   SELECT EXISTS(SELECT FROM case_authority_scopes WHERE organization_id=OLD.organization_id AND claim_id=OLD.claim_id) INTO linked;
   IF linked AND (TG_OP='DELETE' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.claim_id IS DISTINCT FROM OLD.claim_id
     OR NEW.member_id IS DISTINCT FROM OLD.member_id) THEN
     RAISE EXCEPTION 'CANONICAL_CLAIM_SUBJECT_IMMUTABLE' USING ERRCODE='42501'; END IF;
 ELSE
   SELECT EXISTS(SELECT FROM case_authority_scopes WHERE organization_id=OLD.organization_id AND (grievance_id=OLD.id OR grievance_mirror_id=OLD.id)) INTO linked;
   IF linked AND (TG_OP='DELETE' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.represented_member_user_id IS DISTINCT FROM OLD.represented_member_user_id OR NEW.grievant_id IS DISTINCT FROM OLD.grievant_id) THEN
     RAISE EXCEPTION 'CANONICAL_GRIEVANCE_SUBJECT_IMMUTABLE' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
`;
const constraint = (table_name: string, name: string, type: string, definition: string) => ({ table_name, name, type, definition });
const fk = (table: string, name: string, columns: string, target: string, targetColumns: string) => constraint(table, name, 'f', `FOREIGN KEY (${columns}) REFERENCES ${target}(${targetColumns})`);
const triggers: PhysicalGuardContract['triggers'][number][] = [];
for (const table of ['case_authority_scopes','case_scope_proposals','case_respondents']) {
  const name = `${table}_guard`;
  triggers.push({ table_name: table, name, function_name:'ue_case_scope_guard',tgtype:31,tgdeferrable:false,tginitdeferred:false,
    definition:`CREATE TRIGGER ${name} BEFORE INSERT OR DELETE OR UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION ue_case_scope_guard()`,args_hex:'' });
  const auditName = `${table}_audit`;
  // A proposal draft requires its ordinary creation audit; settlement requires the deferred complete mutation audit.
  triggers.push({ table_name:table,name:auditName,function_name:'ue_case_scope_audit_guard',tgtype:21,tgdeferrable:true,tginitdeferred:true,
    definition:`CREATE CONSTRAINT TRIGGER ${auditName} AFTER INSERT OR UPDATE ON public.${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ue_case_scope_audit_guard()`,args_hex:'' });
}
for (const table of ['claims','grievances']) {
  const name=`${table}_canonical_subject_guard`;
  triggers.push({table_name:table,name,function_name:'ue_case_scope_parent_subject_guard',tgtype:31,tgdeferrable:false,tginitdeferred:false,
    definition:`CREATE TRIGGER ${name} BEFORE INSERT OR DELETE OR UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION ue_case_scope_parent_subject_guard()`,args_hex:''});
}
export const CASE_SCOPE_PHYSICAL_GUARDS = {
  source:'apps/union-eyes/db/auth/case-scope-physical-guards.ts',references:[],
  tables:['claims','grievances','bargaining_units','case_territories','case_authority_scopes','case_scope_proposals','case_respondents','ue_authority_issuance_rules','ue_authority_approval_requests'],
  functions:[
    {name:'ue_case_scope_draft_authorized',body:draftAuthorized,returns:'boolean',args:'row_org uuid, row_case uuid',volatility:'s',language:'sql',path:'pg_catalog,public,pg_temp',callable:true},
    {name:'ue_case_scope_amendment_authorized',body:authorized,returns:'boolean',args:'row_org uuid, row_case uuid, rule_id uuid',volatility:'s',language:'sql',path:'pg_catalog,public,pg_temp',callable:true},
    {name:'ue_case_scope_guard',body:guard,returns:'trigger',args:'',volatility:'v',language:'plpgsql',path:'pg_catalog,public,pg_temp',callable:false},
    {name:'ue_case_scope_audit_guard',body:audit,returns:'trigger',args:'',volatility:'v',language:'plpgsql',path:'pg_catalog,public,pg_temp',callable:false},
    {name:'ue_case_scope_parent_subject_guard',body:parentGuard,returns:'trigger',args:'',volatility:'v',language:'plpgsql',path:'pg_catalog,public,pg_temp',callable:false},
  ],
  constraints:[
    ...[['claims','claim_id'],['grievances','id'],['bargaining_units','id'],['ue_authority_issuance_rules','id'],['ue_authority_approval_requests','id']].map(([t,key]) => constraint(t,`${t}_scope_org_key_uniq`,'u',`UNIQUE (organization_id, ${key})`)),
    fk('case_authority_scopes','case_scope_claim_tenant_fk','organization_id, claim_id','claims','organization_id, claim_id'),
    fk('case_authority_scopes','case_scope_grievance_tenant_fk','organization_id, grievance_id','grievances','organization_id, id'),
    fk('case_authority_scopes','case_scope_mirror_tenant_fk','organization_id, grievance_mirror_id','grievances','organization_id, id'),
    fk('grievances','grievances_canonical_member_principal_fk','represented_member_user_id','user_management.users','user_id'),
    ...['case_authority_scopes','case_scope_proposals'].flatMap(t=>[
      fk(t,`${t}_unit_tenant_fk`,'organization_id, unit_id','bargaining_units','organization_id, id'),
      fk(t,`${t}_territory_tenant_fk`,'organization_id, territory_id','case_territories','organization_id, id'),
    ]),
    ...['case_scope_proposals','case_respondents'].map(t=>fk(t,`${t}_scope_tenant_fk`,'organization_id, scope_id','case_authority_scopes','organization_id, id')),
    fk('case_scope_proposals','case_scope_proposal_rule_tenant_fk','organization_id, issuance_rule_id','ue_authority_issuance_rules','organization_id, id'),
    fk('case_scope_proposals','case_scope_proposal_approval_tenant_fk','organization_id, approval_request_id','ue_authority_approval_requests','organization_id, id'),
    fk('case_authority_scopes','case_scope_last_proposal_tenant_fk','organization_id, last_proposal_id','case_scope_proposals','organization_id, id'),
    fk('case_respondents','case_respondent_proposal_tenant_fk','organization_id, proposal_id','case_scope_proposals','organization_id, id'),
    fk('case_respondents','case_respondent_revoked_proposal_tenant_fk','organization_id, revoked_proposal_id','case_scope_proposals','organization_id, id'),
    fk('case_respondents','case_respondent_canonical_principal_fk','respondent_user_id','user_management.users','user_id'),
  ],triggers,
} satisfies PhysicalGuardContract;
