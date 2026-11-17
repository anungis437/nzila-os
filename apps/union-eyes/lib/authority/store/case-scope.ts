/** Governed logical-case facts (UE-CAP-B-002 / DEC-IA-10).
 * No default scope rule, role-derived authority, free-text identity inference or live backfill.
 * Call ONLY inside the caller's canonical transaction; all writes and required audit share it.
 */
import { randomUUID } from 'node:crypto';
import { appendCanonicalAuditLog } from '@/lib/audit/canonical-audit-chain';
import { ACTIVE_RECUSAL_SQL, activeMembership, assessMandate, validInstant } from '../common';
import { PLACEHOLDER_INSTRUMENT } from '../issuance';
import { asRlsTx } from './audit';
import { AuthorityStoreError, bindSessionActor, isPrincipalId, isUuid, parsePgTextArray, type SqlExecutor } from './executor';
import { enforceAuthority, type EnforcementDeps } from './enforce';
import { loadActiveIssuanceRule, loadAuthorityFacts, loadIssuanceApproval } from './facts';
import { openApprovalRequest } from './mutations';

type Row = Record<string, unknown>;
export interface CaseScopeActor { organizationId: string; caseId: string; actorUserId: string }
export interface CaseScopeInput extends CaseScopeActor {
  unitId: string | null;
  territoryId: string | null;
  respondentUserIds: readonly string[];
  expectedRevision: number;
  namedApproverIds?: readonly string[];
}
const refuse = (message: string): never => { throw new AuthorityStoreError('DENIED', message); };
const result = async (exec: SqlExecutor, query: string, params: unknown[]) => (await exec.query<Row>(query, params)).rows;
function validateActor(i: CaseScopeActor) {
  if (!isUuid(i.organizationId) || !isUuid(i.caseId) || !isPrincipalId(i.actorUserId)) throw new AuthorityStoreError('INVALID_CONTEXT', 'Canonical tenant, logical case and principal required');
}
async function audit(exec: SqlExecutor, i: CaseScopeActor, action: string, proposalId: string | null, details: Row = {}) {
  await appendCanonicalAuditLog(asRlsTx(exec), { organizationId: i.organizationId, userId: i.actorUserId,
    action, resourceType: 'case_authority_scope', resourceId: i.caseId, details: { ...details, caseScopeProposalId: proposalId } });
}

/** Empty provenance grants nothing. Bind before a claim-to-grievance mirror is created. */
export async function ensureCaseAuthorityScope(exec: SqlExecutor, deps: EnforcementDeps, i: CaseScopeActor): Promise<Row> {
  validateActor(i);
  await bindSessionActor(exec, i.actorUserId);
  await exec.query("SELECT pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||$1::text,0))", [i.caseId]);
  await exec.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${i.organizationId}:case-scope:${i.caseId}`]);
  const existing = await result(exec, 'SELECT * FROM case_authority_scopes WHERE organization_id=$1 AND case_id=$2 FOR UPDATE', [i.organizationId, i.caseId]);
  if (existing.length > 1) return refuse('CONTRADICTORY_CASE_SCOPE');
  const req = { principalUserId: i.actorUserId, organizationId: i.organizationId, resource: { type: 'case' as const, id: i.caseId, organizationId: i.organizationId } };
  const read = await enforceAuthority(exec, deps, { ...req, action: 'case:read' }, { authenticated: true });
  if (read.effect !== 'allow') {
    const assign = await enforceAuthority(exec, deps, { ...req, action: 'case:assign' }, { authenticated: true });
    if (assign.effect !== 'allow') return refuse('Case provenance requires current case read or assignment authority');
  }
  if (existing.length === 1) return existing[0];
  const claims = await result(exec, 'SELECT claim_id FROM claims WHERE organization_id=$1 AND claim_id=$2 FOR UPDATE', [i.organizationId, i.caseId]);
  const grievances = await result(exec, 'SELECT id FROM grievances WHERE organization_id=$1 AND id=$2 FOR UPDATE', [i.organizationId, i.caseId]);
  if (claims.length + grievances.length !== 1) return refuse('AMBIGUOUS_OR_MISSING_CANONICAL_CASE_PARENT');
  const rows = await result(exec, `INSERT INTO case_authority_scopes(id,organization_id,case_id,claim_id,grievance_id,unit_id,territory_id,revision,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,NULL,NULL,0,now(),now()) RETURNING *`, [randomUUID(), i.organizationId, i.caseId, claims.length ? i.caseId : null, grievances.length ? i.caseId : null]);
  await audit(exec, i, 'case.scope.parent_bound', null, { scopeId: rows[0].id, parentKind: claims.length ? 'claim' : 'grievance' });
  return rows[0];
}

/** Provenance only: bind the authorized escalation's same-id mirror without changing scope or granting access.
 * The database rechecks live draft authority, original canonical principal, exact tenant/id and atomic audit.
 */
export async function bindCaseGrievanceMirror(exec: SqlExecutor, _deps: EnforcementDeps, i: CaseScopeActor): Promise<void> {
  validateActor(i); await bindSessionActor(exec, i.actorUserId);
  await exec.query("SELECT pg_advisory_xact_lock(hashtextextended('ue.case-mail.resource:'||$1::text,0))", [i.caseId]);
  const rows = await result(exec, `UPDATE case_authority_scopes SET grievance_mirror_id=case_id,mirror_recorded_by=$1,mirror_recorded_at=now(),updated_at=now()
    WHERE organization_id=$2 AND case_id=$3 AND claim_id=case_id AND grievance_id IS NULL AND grievance_mirror_id IS NULL RETURNING id`, [i.actorUserId, i.organizationId, i.caseId]);
  if (rows.length !== 1) return refuse('MISSING_OR_ALREADY_BOUND_CANONICAL_CLAIM_PARENT');
  await audit(exec, i, 'case.scope.mirror_bound', null, { scopeId: rows[0].id, grievanceMirrorId: i.caseId });
}

/** Facts amendment is a separately named, unadopted-by-default power, never inferred from assignment alone.
 * A resource-id supervisory grant is deliberately required: an amendment cannot create its own unit/territory jurisdiction.
 */
async function requireScopeRule(exec: SqlExecutor, deps: EnforcementDeps, i: CaseScopeActor) {
  const now = (deps.now ?? (() => new Date()))();
  if (!validInstant(now)) return refuse('INVALID_AUTHORITY_CLOCK');
  const decision = await enforceAuthority(exec, deps, { principalUserId: i.actorUserId, organizationId: i.organizationId,
    action: 'case:assign', resource: { type: 'case', id: i.caseId, organizationId: i.organizationId } }, { authenticated: true });
  if (decision.effect !== 'allow') return refuse('Current case assignment authority required for scope amendment');
  const facts = await loadAuthorityFacts(exec, deps.memberships, { organizationId: i.organizationId, principalUserId: i.actorUserId, authenticated: true, now });
  const membership = activeMembership(facts, i.organizationId);
  const rule = await loadActiveIssuanceRule(exec, i.organizationId, 'case_assignment', 'amend');
  if (!rule || rule.status !== 'active' || !rule.allowedPowers.includes('scope') || !rule.sourceInstrument.trim() || rule.sourceInstrument === PLACEHOLDER_INSTRUMENT ||
      !membership || !rule.issuerCapacities.some((capacity) => membership.capacities.includes(capacity))) return refuse('NO_ADOPTED_CASE_SCOPE_AMENDMENT_RULE');
  if (!facts.mandates.some((m) => m.kind === 'supervisory' && m.principalUserId === i.actorUserId && m.powers.includes('assign') &&
      m.scope.resourceIds?.includes(i.caseId) && assessMandate(m, i.organizationId, now).effective)) return refuse('Scope amendment needs explicit case-id assignment jurisdiction');
  if (rule.issuerMandateKind && !facts.mandates.some((m) => m.kind === rule.issuerMandateKind && m.principalUserId === i.actorUserId &&
      m.powers.includes(rule.issuerMandatePower ?? '') && assessMandate(m, i.organizationId, now).effective)) return refuse('Issuer mandate required by scope amendment rule');
  return rule;
}

async function validateTargets(exec: SqlExecutor, i: CaseScopeInput) {
  if ((i.unitId !== null && !isUuid(i.unitId)) || (i.territoryId !== null && !isUuid(i.territoryId)) ||
      !Number.isSafeInteger(i.expectedRevision) || i.expectedRevision < 0 || !Array.isArray(i.respondentUserIds) || i.respondentUserIds.length > 200 ||
      i.respondentUserIds.some((id) => !isPrincipalId(id)) || new Set(i.respondentUserIds).size !== i.respondentUserIds.length) return refuse('INVALID_SCOPE_OR_PARTY_INPUT');
  if (i.respondentUserIds.includes(i.actorUserId)) return refuse('ADVERSE_PARTY_CANNOT_AMEND_SCOPE');
  if (i.unitId && !(await result(exec, "SELECT id FROM bargaining_units WHERE id=$1 AND organization_id=$2 AND status='active' FOR SHARE", [i.unitId, i.organizationId])).length) return refuse('UNIT_NOT_ACTIVE_IN_ORGANIZATION');
  if (i.territoryId && !(await result(exec, 'SELECT id FROM case_territories WHERE id=$1 AND organization_id=$2 AND retired_at IS NULL FOR SHARE', [i.territoryId, i.organizationId])).length) return refuse('TERRITORY_NOT_ACTIVE_IN_ORGANIZATION');
  // Canonical principal referential integrity is also enforced by the physical FK. No profile or free-text lookup substitutes.
}

export async function proposeCaseScope(exec: SqlExecutor, deps: EnforcementDeps, i: CaseScopeInput): Promise<{ proposalId: string; approvalRequestId: string }> {
  validateActor(i); await bindSessionActor(exec, i.actorUserId);
  const scope = await ensureCaseAuthorityScope(exec, deps, i);
  const rule = await requireScopeRule(exec, deps, i);
  await validateTargets(exec, i);
  if (Number(scope.revision) !== i.expectedRevision) throw new AuthorityStoreError('PRECONDITION', 'STALE_CASE_SCOPE_REVISION');
  const proposalId = randomUUID();
  const currentParties = await result(exec, 'SELECT respondent_user_id FROM case_respondents WHERE organization_id=$1 AND scope_id=$2 AND revoked_at IS NULL', [i.organizationId, scope.id]);
  const approvalRequestId = await openApprovalRequest(exec, { organizationId: i.organizationId, subjectType: 'case_scope', subjectId: proposalId,
    proposedBy: i.actorUserId, requiredApprovals: Math.max(2, rule.requiredIndependentApprovals), riskClass: 'high', namedApproverIds: i.namedApproverIds,
    eligibleCapacities: ['executive'], adverseUserIds: [...new Set([...currentParties.map((r) => String(r.respondent_user_id)), ...i.respondentUserIds])] });
  await exec.query(`INSERT INTO case_scope_proposals(id,organization_id,scope_id,expected_revision,unit_id,territory_id,respondent_user_ids,proposed_by,issuance_rule_id,approval_request_id,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::varchar[],$8,$9,$10,now(),now())`, [proposalId, i.organizationId, scope.id, i.expectedRevision, i.unitId, i.territoryId, [...i.respondentUserIds].sort(), i.actorUserId, rule.id, approvalRequestId]);
  await audit(exec, i, 'case.scope.proposed', proposalId, { expectedRevision: i.expectedRevision, approvalRequestId });
  return { proposalId, approvalRequestId };
}

export async function applyCaseScope(exec: SqlExecutor, deps: EnforcementDeps, i: CaseScopeActor & { proposalId: string }): Promise<void> {
  validateActor(i); if (!isUuid(i.proposalId)) return refuse('INVALID_SCOPE_PROPOSAL');
  await bindSessionActor(exec, i.actorUserId);
  const scope = await ensureCaseAuthorityScope(exec, deps, i);
  const rule = await requireScopeRule(exec, deps, i);
  const proposal = (await result(exec, 'SELECT * FROM case_scope_proposals WHERE organization_id=$1 AND scope_id=$2 AND id=$3 FOR UPDATE', [i.organizationId, scope.id, i.proposalId]))[0];
  if (!proposal || proposal.applied_at !== null || proposal.issuance_rule_id !== rule.id || Number(proposal.expected_revision) !== Number(scope.revision)) return refuse('STALE_OR_SUBSTITUTED_SCOPE_PROPOSAL');
  const input: CaseScopeInput = { ...i, unitId: proposal.unit_id as string | null, territoryId: proposal.territory_id as string | null,
    respondentUserIds: parsePgTextArray(proposal.respondent_user_ids), expectedRevision: Number(proposal.expected_revision) };
  await validateTargets(exec, input);
  const approval = await loadIssuanceApproval(exec, i.organizationId, String(proposal.approval_request_id));
  if (!approval || approval.status !== 'satisfied' || approval.subjectType !== 'case_scope' || approval.subjectId !== i.proposalId) return refuse('EXACT_SCOPE_APPROVAL_REQUIRED');
  const lines = [...new Set(approval.approvingLines)].filter((p) => p !== proposal.proposed_by && p !== i.actorUserId && !input.respondentUserIds.includes(p));
  const memberships = await deps.memberships(exec, i.organizationId, lines);
  const recusals = await result(exec, `SELECT principal_user_id FROM ue_authority_recusals WHERE organization_id=$1 AND principal_user_id=ANY($2::text[])
    AND ((resource_type='case' AND resource_id=$3) OR (resource_type='approval_request' AND resource_id=$4)) AND ${ACTIVE_RECUSAL_SQL}`,
  [i.organizationId, lines, i.caseId, proposal.approval_request_id]);
  const liveLines = lines.filter((p) => memberships.filter((m) => m.userId === p && m.organizationId === i.organizationId && m.status === 'active' && m.capacities.includes('executive')).length === 1 && !recusals.some((r) => r.principal_user_id === p));
  if (liveLines.length < Math.max(2, rule.requiredIndependentApprovals)) return refuse('LIVE_INDEPENDENT_SCOPE_APPROVAL_REQUIRED');
  await exec.query(`UPDATE case_authority_scopes SET unit_id=$1,territory_id=$2,revision=revision+1,last_proposal_id=$3,updated_at=now()
    WHERE organization_id=$4 AND id=$5 AND revision=$6`, [input.unitId, input.territoryId, i.proposalId, i.organizationId, scope.id, input.expectedRevision]);
  await exec.query(`UPDATE case_respondents SET revoked_at=now(),revoked_by=$1,revoked_proposal_id=$2,updated_at=now()
    WHERE organization_id=$3 AND scope_id=$4 AND revoked_at IS NULL AND NOT (respondent_user_id=ANY($5::text[]))`, [i.actorUserId, i.proposalId, i.organizationId, scope.id, [...input.respondentUserIds]]);
  for (const party of input.respondentUserIds) await exec.query(`INSERT INTO case_respondents(id,organization_id,scope_id,respondent_user_id,proposal_id,recorded_by,recorded_at,created_at,updated_at)
    SELECT $1::uuid,$2::uuid,$3::uuid,$4::varchar(255),$5::uuid,$6::varchar(255),now(),now(),now()
    WHERE NOT EXISTS(SELECT FROM case_respondents WHERE organization_id=$2::uuid AND scope_id=$3::uuid AND respondent_user_id=$4::varchar(255) AND revoked_at IS NULL)`, [randomUUID(), i.organizationId, scope.id, party, i.proposalId, i.actorUserId]);
  await exec.query('UPDATE case_scope_proposals SET applied_at=now(),applied_by=$1,updated_at=now() WHERE organization_id=$2 AND id=$3 AND applied_at IS NULL', [i.actorUserId, i.organizationId, i.proposalId]);
  await audit(exec, i, 'case.scope.amended', i.proposalId, { revision: input.expectedRevision + 1, approvalRequestId: proposal.approval_request_id });
}
