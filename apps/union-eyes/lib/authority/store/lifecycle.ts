/**
 * Authority store — governed lifecycle.
 *
 * Every operation here follows the same shape: load the ACTIVE issuance rule and
 * the issuer's authoritative facts, ask the pure issuance policy, refuse unless it
 * allows, then write through the row writers (which audit in the same
 * transaction) and let the database re-check structure. Issuing authority is
 * never the issued authority, and with no active rule nothing is issued.
 */
import { randomUUID } from 'node:crypto'
import { decideIssuance, DEFAULT_ISSUANCE_TEMPLATES, PLACEHOLDER_INSTRUMENT, type IssuanceDecision, type IssuanceDomain, type IssuanceOperation, type IssuanceRule, type IssuanceRuleTemplate, type IssuanceRequest } from '../issuance'
import type { Capacity, Mandate, MandateKind, MandateScope, Membership, ResourceType } from '../ontology'
import { auditAuthorityMutation } from './audit'
import { enforceAuthority, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, type SqlExecutor } from './executor'
import { loadActiveIssuanceRule, loadAuthorityFacts, loadHolderMandates, loadIssuanceApproval, mapMandate } from './facts'
import {
  changeMandateState,
  insertAcceptance,
  insertDelegation,
  insertMandate,
  insertRecusal,
  insertRelationship,
  liftRecusalRow,
  openApprovalRequest,
  requirePrincipals,
  requireUuids,
  revokeDelegation as revokeDelegationRow,
} from './mutations'
import { loadCase } from './resources'

type Row = Record<string, unknown>

/** Capacities that may draft, approve and activate institutional issuance rules (configurable at the call site). */
export const RULE_ADOPTION_CAPACITIES: readonly Capacity[] = ['executive']

const refuse = (decision: IssuanceDecision): never => {
  throw new AuthorityStoreError('DENIED', `${decision.domain}/${decision.operation} denied: ${decision.reasons.map((r) => r.code).join(', ') || 'no reason recorded'}`)
}

async function holderMembershipOf(exec: SqlExecutor, deps: EnforcementDeps, org: string, holder: string): Promise<Membership | null> {
  const rows = (await deps.memberships(exec, org, [holder])).filter((m) => m.userId === holder && m.organizationId === org)
  return rows.length === 1 ? rows[0] : null
}

interface Evaluate {
  organizationId: string
  issuerUserId: string
  holderUserId: string
  domain: IssuanceDomain
  operation: IssuanceOperation
  request: Partial<IssuanceRequest>
  approvalRequestId?: string | null
  instrumentId?: string
}

async function evaluateIssuance(exec: SqlExecutor, deps: EnforcementDeps, e: Evaluate): Promise<{ decision: IssuanceDecision; rule: IssuanceRule | null }> {
  const now = (deps.now ?? (() => new Date()))()
  const rule = await loadActiveIssuanceRule(exec, e.organizationId, e.domain, e.operation)
  const facts = await loadAuthorityFacts(exec, deps.memberships, {
    organizationId: e.organizationId,
    principalUserId: e.issuerUserId,
    authenticated: true,
    now,
  })
  const holderMembership = await holderMembershipOf(exec, deps, e.organizationId, e.holderUserId)
  const holderMandates = e.operation === 'issue' || e.operation === 'amend' ? await loadHolderMandates(exec, e.organizationId, e.holderUserId) : []
  let approval = null
  if (e.approvalRequestId) {
    const a = await loadIssuanceApproval(exec, e.organizationId, e.approvalRequestId)
    // The approval must be bound to THIS exact instrument and domain, or it counts for nothing.
    if (a && a.subjectType === `issuance:${e.domain}` && a.subjectId === e.instrumentId) {
      approval = { status: a.status, approvingLines: a.approvingLines }
    }
  }
  const decision = decideIssuance(
    {
      ...e.request,
      issuerUserId: e.issuerUserId,
      organizationId: e.organizationId,
      domain: e.domain,
      operation: e.operation,
      holderUserId: e.holderUserId,
      holderMandates,
      approval,
    },
    facts,
    holderMembership,
    rule,
    now,
  )
  return { decision, rule }
}

// ── Issuance rules ───────────────────────────────────────────────────────────

async function requireAdopter(exec: SqlExecutor, deps: EnforcementDeps, org: string, user: string): Promise<void> {
  const m = await holderMembershipOf(exec, deps, org, user)
  if (!m || m.status !== 'active' || !m.capacities.some((c) => RULE_ADOPTION_CAPACITIES.includes(c))) {
    throw new AuthorityStoreError('DENIED', 'only an active member with an adoption capacity may draft or adopt issuance rules')
  }
}

export interface DraftRuleInput extends Omit<IssuanceRuleTemplate, 'rationale'> {
  organizationId: string
  draftedBy: string
  sourceInstrument?: string
}

/** Drafts an INACTIVE rule. A draft grants nothing. */
export async function draftIssuanceRule(exec: SqlExecutor, deps: EnforcementDeps, i: DraftRuleInput): Promise<string> {
  requireUuids(i.organizationId)
  requirePrincipals(i.draftedBy)
  await requireAdopter(exec, deps, i.organizationId, i.draftedBy)
  const row = (
    await exec.query<Row>(
      `INSERT INTO ue_authority_issuance_rules
         (organization_id, domain, operation, issuer_capacities, issuer_mandate_kind, issuer_mandate_power, allowed_powers,
          max_term_days, requires_acceptance, required_independent_approvals, version, status, source_instrument, drafted_by)
       VALUES ($1,$2,$3,$4::text[],$5,$6,$7::text[],$8,$9,$10,
               COALESCE((SELECT max(version) FROM ue_authority_issuance_rules WHERE organization_id = $1 AND domain = $2 AND operation = $3), 0) + 1,
               'draft',$11,$12) RETURNING id::text AS id`,
      [
        i.organizationId, i.domain, i.operation, [...i.issuerCapacities], i.issuerMandateKind ?? null, i.issuerMandatePower ?? null,
        [...i.allowedPowers], i.maxTermDays, i.requiresAcceptance, i.requiredIndependentApprovals,
        i.sourceInstrument ?? PLACEHOLDER_INSTRUMENT, i.draftedBy,
      ],
    )
  ).rows[0]
  const id = String(row.id)
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'rule.draft', resourceType: 'ue_authority_issuance_rules', resourceId: id, details: { domain: i.domain, operation: i.operation } })
  return id
}

/** Drafts every default template as an inactive rule. Nothing becomes effective until activated with a real source. */
export async function draftDefaultIssuanceRules(exec: SqlExecutor, deps: EnforcementDeps, organizationId: string, draftedBy: string): Promise<string[]> {
  const ids: string[] = []
  for (const t of DEFAULT_ISSUANCE_TEMPLATES) {
    const { rationale: _rationale, ...rest } = t
    ids.push(await draftIssuanceRule(exec, deps, { ...rest, organizationId, draftedBy }))
  }
  return ids
}

export interface ActivateRuleInput {
  organizationId: string
  ruleId: string
  actorUserId: string
  /** At least two, distinct, none of them the drafter. */
  approverUserIds: readonly string[]
  /** The bylaw, constitution clause or resolution that authorises this rule. Required. */
  sourceInstrument: string
}

export async function activateIssuanceRule(exec: SqlExecutor, deps: EnforcementDeps, i: ActivateRuleInput): Promise<void> {
  requireUuids(i.organizationId, i.ruleId)
  requirePrincipals(i.actorUserId, ...i.approverUserIds)
  if (!i.sourceInstrument || i.sourceInstrument.trim() === '' || i.sourceInstrument === PLACEHOLDER_INSTRUMENT) {
    throw new AuthorityStoreError('PRECONDITION', 'a real institutional source instrument is required to activate a rule')
  }
  const approvers = [...new Set(i.approverUserIds)]
  if (approvers.length !== i.approverUserIds.length || approvers.length < 2) {
    throw new AuthorityStoreError('PRECONDITION', 'two or more distinct approvers are required')
  }
  const rule = (await exec.query<Row>(`SELECT domain, operation, status, drafted_by FROM ue_authority_issuance_rules WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.ruleId])).rows[0]
  if (!rule || rule.status !== 'draft') throw new AuthorityStoreError('NOT_FOUND', 'no draft rule with this id')
  if (approvers.includes(String(rule.drafted_by))) throw new AuthorityStoreError('DENIED', 'a rule cannot be approved by its drafter')
  for (const u of [i.actorUserId, ...approvers]) await requireAdopter(exec, deps, i.organizationId, u)

  // A newer version replaces the active one in the same transaction.
  const retired = await exec.query<Row>(
    `UPDATE ue_authority_issuance_rules SET status = 'retired', retired_at = now()
      WHERE organization_id = $1 AND domain = $2 AND operation = $3 AND status = 'active' RETURNING id::text AS id`,
    [i.organizationId, rule.domain, rule.operation],
  )
  await exec.query(
    `UPDATE ue_authority_issuance_rules
        SET status = 'active', approved_by = $3::text[], activated_at = now(), source_instrument = $4
      WHERE organization_id = $1 AND id = $2 AND status = 'draft'`,
    [i.organizationId, i.ruleId, approvers, i.sourceInstrument],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'rule.activate',
    resourceType: 'ue_authority_issuance_rules',
    resourceId: i.ruleId,
    details: { actor: i.actorUserId, approvers, sourceInstrument: i.sourceInstrument, retired: retired.rows.map((r) => r.id) },
  })
}

export async function retireIssuanceRule(exec: SqlExecutor, deps: EnforcementDeps, organizationId: string, ruleId: string, actorUserId: string): Promise<void> {
  requireUuids(organizationId, ruleId)
  requirePrincipals(actorUserId)
  await requireAdopter(exec, deps, organizationId, actorUserId)
  const r = await exec.query(`UPDATE ue_authority_issuance_rules SET status = 'retired', retired_at = now() WHERE organization_id = $1 AND id = $2 AND status <> 'retired' RETURNING id`, [organizationId, ruleId])
  if (r.rows.length !== 1) throw new AuthorityStoreError('NOT_FOUND', 'no live rule with this id')
  await auditAuthorityMutation(exec, { organizationId, action: 'rule.retire', resourceType: 'ue_authority_issuance_rules', resourceId: ruleId, details: { actor: actorUserId } })
}

// ── Mandates ─────────────────────────────────────────────────────────────────

export interface IssueMandateInput {
  id?: string
  organizationId: string
  issuerUserId: string
  holderUserId: string
  kind: MandateKind
  powers: readonly string[]
  scope?: MandateScope
  monetaryLimitMinor?: number | null
  currency?: string | null
  sourceInstrument?: string
  justification?: string | null
  effectiveAt: Date
  expiresAt: Date
  approvalRequestId?: string | null
  supersedesId?: string | null
}

function mandateRequest(i: IssueMandateInput): Partial<IssuanceRequest> {
  return {
    powers: i.powers,
    scope: i.scope,
    monetaryLimitMinor: i.monetaryLimitMinor,
    currency: i.currency,
    sourceInstrument: i.sourceInstrument,
    justification: i.justification,
    effectiveAt: i.effectiveAt,
    expiresAt: i.expiresAt,
  }
}

/** Opens the independent approval an issuance rule requires, bound to the exact instrument id that will be issued. */
export async function requestIssuanceApproval(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: IssueMandateInput & { instrumentId: string; namedApproverIds?: readonly string[] },
): Promise<string> {
  requireUuids(i.organizationId, i.instrumentId)
  const { decision, rule } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: i.holderUserId,
    domain: i.kind, operation: 'issue', request: { ...mandateRequest(i), stage: 'request' },
  })
  if (decision.effect !== 'allow' || !rule) return refuse(decision)
  if (rule.requiredIndependentApprovals < 1) throw new AuthorityStoreError('PRECONDITION', 'this issuance does not require an approval')
  return openApprovalRequest(exec, {
    organizationId: i.organizationId,
    subjectType: `issuance:${i.kind}`,
    subjectId: i.instrumentId,
    proposedBy: i.issuerUserId,
    subjectAuthorId: i.holderUserId,
    requiredApprovals: rule.requiredIndependentApprovals,
    riskClass: 'medium',
    namedApproverIds: i.namedApproverIds,
  })
}

export async function issueMandate(exec: SqlExecutor, deps: EnforcementDeps, i: IssueMandateInput): Promise<{ mandateId: string; decision: IssuanceDecision }> {
  requireUuids(i.organizationId, i.id, i.approvalRequestId, i.supersedesId)
  requirePrincipals(i.issuerUserId, i.holderUserId)
  const id = i.id ?? randomUUID()
  const { decision, rule } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: i.holderUserId,
    domain: i.kind, operation: 'issue', request: mandateRequest(i), approvalRequestId: i.approvalRequestId, instrumentId: id,
  })
  if (decision.effect !== 'allow' || !rule) return refuse(decision)
  let approvedBy: string | null = null
  if (i.kind === 'emergency_access' && i.approvalRequestId) {
    const a = await loadIssuanceApproval(exec, i.organizationId, i.approvalRequestId)
    approvedBy = a?.approvingLines.find((l) => l !== i.issuerUserId && l !== i.holderUserId) ?? null
  }
  const mandateId = await insertMandate(exec, {
    id,
    organizationId: i.organizationId,
    principalUserId: i.holderUserId,
    kind: i.kind,
    powers: i.powers,
    scope: i.scope,
    monetaryLimitMinor: i.monetaryLimitMinor,
    currency: i.currency,
    sourceInstrument: i.sourceInstrument ?? rule.sourceInstrument,
    grantedBy: i.issuerUserId,
    approvedBy,
    justification: i.justification,
    effectiveAt: i.effectiveAt,
    expiresAt: i.expiresAt,
    issuanceRuleId: rule.id,
    approvalRequestId: i.approvalRequestId,
    supersedesId: i.supersedesId,
  })
  return { mandateId, decision }
}

async function loadMandateRow(exec: SqlExecutor, organizationId: string, id: string): Promise<Mandate> {
  const row = (await exec.query<Row>(`SELECT * FROM ue_authority_mandates WHERE organization_id = $1 AND id = $2`, [organizationId, id])).rows[0]
  if (!row) throw new AuthorityStoreError('NOT_FOUND', 'mandate not found in this organization')
  return mapMandate(row)
}

/** Suspend, resume (governed by the 'suspend' rule) or revoke a mandate. Revoking one's own mandate (surrender) is always permitted by the policy. */
export async function changeMandate(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; issuerUserId: string; mandateId: string; change: 'revoke' | 'suspend' | 'resume' },
): Promise<IssuanceDecision> {
  requireUuids(i.organizationId, i.mandateId)
  requirePrincipals(i.issuerUserId)
  const m = await loadMandateRow(exec, i.organizationId, i.mandateId)
  const { decision } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: m.principalUserId,
    domain: m.kind, operation: i.change === 'revoke' ? 'revoke' : 'suspend', request: {},
  })
  if (decision.effect !== 'allow') return refuse(decision)
  await changeMandateState(exec, i.organizationId, i.mandateId, i.change, i.issuerUserId)
  return decision
}

/** Amend = revoke the old mandate and issue its replacement. Needs both an 'amend' and an 'issue' rule, so ceilings and approvals still apply. */
export async function amendMandate(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: Omit<IssueMandateInput, 'kind' | 'holderUserId' | 'supersedesId'> & { mandateId: string },
): Promise<{ mandateId: string; supersedes: string }> {
  requireUuids(i.organizationId, i.mandateId)
  const old = await loadMandateRow(exec, i.organizationId, i.mandateId)
  const authority = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: old.principalUserId,
    domain: old.kind, operation: 'amend', request: { ...mandateRequest({ ...i, kind: old.kind, holderUserId: old.principalUserId }), stage: 'request' },
  })
  if (authority.decision.effect !== 'allow') return refuse(authority.decision)
  await changeMandateState(exec, i.organizationId, i.mandateId, 'revoke', i.issuerUserId)
  const issued = await issueMandate(exec, deps, { ...i, kind: old.kind, holderUserId: old.principalUserId, supersedesId: i.mandateId })
  return { mandateId: issued.mandateId, supersedes: i.mandateId }
}

export async function acceptInstrument(
  exec: SqlExecutor,
  i: { organizationId: string; instrumentType: 'mandate' | 'delegation'; instrumentId: string; holderUserId: string },
): Promise<string> {
  return insertAcceptance(exec, { organizationId: i.organizationId, instrumentType: i.instrumentType, instrumentId: i.instrumentId, acceptedBy: i.holderUserId })
}

// ── Delegations ──────────────────────────────────────────────────────────────

export interface IssueDelegationInput {
  id?: string
  organizationId: string
  delegatorUserId: string
  delegateUserId: string
  office: string
  actions: readonly string[]
  resourceTypes: readonly ResourceType[]
  effectiveAt: Date
  expiresAt: Date
  approvalRequestId?: string | null
}

export async function issueDelegation(exec: SqlExecutor, deps: EnforcementDeps, i: IssueDelegationInput): Promise<{ delegationId: string }> {
  requireUuids(i.organizationId, i.id, i.approvalRequestId)
  requirePrincipals(i.delegatorUserId, i.delegateUserId)
  const id = i.id ?? randomUUID()
  const { decision, rule } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.delegatorUserId, holderUserId: i.delegateUserId,
    domain: 'delegation', operation: 'issue',
    request: { powers: i.actions, effectiveAt: i.effectiveAt, expiresAt: i.expiresAt }, approvalRequestId: i.approvalRequestId, instrumentId: id,
  })
  if (decision.effect !== 'allow' || !rule) return refuse(decision)
  const delegationId = await insertDelegation(exec, { ...i, id, issuanceRuleId: rule.id })
  return { delegationId }
}

export async function revokeDelegationGoverned(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; issuerUserId: string; delegationId: string },
): Promise<void> {
  requireUuids(i.organizationId, i.delegationId)
  const d = (await exec.query<Row>(`SELECT delegate_user_id FROM ue_authority_delegations WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.delegationId])).rows[0]
  if (!d) throw new AuthorityStoreError('NOT_FOUND', 'delegation not found in this organization')
  const { decision } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: String(d.delegate_user_id),
    domain: 'delegation', operation: 'revoke', request: {},
  })
  if (decision.effect !== 'allow') return refuse(decision)
  await revokeDelegationRow(exec, i.organizationId, i.delegationId, i.issuerUserId)
}

// ── Recusal ──────────────────────────────────────────────────────────────────

/** A person may always recuse THEMSELVES: it only ever removes authority. */
export async function declareOwnRecusal(
  exec: SqlExecutor,
  i: { organizationId: string; principalUserId: string; resourceType: ResourceType; resourceId: string; reason: string },
): Promise<string> {
  return insertRecusal(exec, i)
}

export async function liftRecusal(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; issuerUserId: string; recusalId: string },
): Promise<void> {
  requireUuids(i.organizationId, i.recusalId)
  const r = (await exec.query<Row>(`SELECT principal_user_id, resource_type, resource_id::text AS resource_id FROM ue_authority_recusals WHERE organization_id = $1 AND id = $2 AND lifted_at IS NULL`, [i.organizationId, i.recusalId])).rows[0]
  if (!r) throw new AuthorityStoreError('NOT_FOUND', 'no active recusal with this id')
  const { decision } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: String(r.principal_user_id),
    domain: 'recusal', operation: 'lift',
    request: { resource: { type: r.resource_type as ResourceType, id: String(r.resource_id), organizationId: i.organizationId } },
  })
  if (decision.effect !== 'allow') return refuse(decision)
  await liftRecusalRow(exec, i.organizationId, i.recusalId, i.issuerUserId)
}

// ── Case assignment ──────────────────────────────────────────────────────────

export async function assignCase(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: {
    organizationId: string
    issuerUserId: string
    caseId: string
    assigneeUserId: string
    relation?: 'assignee' | 'collaborator'
    permissions?: readonly string[]
    effectiveAt: Date
    expiresAt?: Date | null
  },
): Promise<string> {
  requireUuids(i.organizationId, i.caseId)
  requirePrincipals(i.issuerUserId, i.assigneeUserId)
  const resource = { type: 'case' as const, id: i.caseId, organizationId: i.organizationId }
  const kernel = await enforceAuthority(exec, deps, { principalUserId: i.issuerUserId, organizationId: i.organizationId, action: 'case:assign', resource }, { authenticated: true })
  const now = (deps.now ?? (() => new Date()))()
  const loaded = await loadCase(exec, { principalUserId: i.issuerUserId, organizationId: i.organizationId, action: 'case:assign', resource }, now)
  const adverse = loaded && loaded.resource.kind === 'case' ? [...loaded.resource.adverseUserIds] : []
  const { decision, rule } = await evaluateIssuance(exec, deps, {
    organizationId: i.organizationId, issuerUserId: i.issuerUserId, holderUserId: i.assigneeUserId,
    domain: 'case_assignment', operation: 'issue',
    request: { powers: i.permissions ?? [], resource, caseAssignAllowed: kernel.effect === 'allow', adverseUserIds: adverse },
  })
  if (decision.effect !== 'allow' || !rule) return refuse(decision)
  return insertRelationship(exec, {
    organizationId: i.organizationId,
    principalUserId: i.assigneeUserId,
    resourceType: 'case',
    resourceId: i.caseId,
    relation: i.relation ?? 'assignee',
    permissions: i.permissions ?? [],
    origin: 'explicit',
    grantedBy: i.issuerUserId,
    effectiveAt: i.effectiveAt,
    expiresAt: i.expiresAt ?? null,
    issuanceRuleId: rule.id,
  })
}

// ── Institutional succession ─────────────────────────────────────────────────

/**
 * Ends an office-holder's authority and installs a successor in ONE transaction:
 * the outgoing holder's office mandates and every delegation they issued are
 * revoked, and the incoming mandate is issued under the normal rule (including any
 * independent approval, bound to the new mandate id).
 */
export async function succeedOffice(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: {
    organizationId: string
    issuerUserId: string
    outgoingUserId: string
    incoming: Omit<IssueMandateInput, 'organizationId' | 'issuerUserId' | 'kind'> & { holderUserId: string }
  },
): Promise<{ revokedMandates: string[]; revokedDelegations: string[]; mandateId: string }> {
  requireUuids(i.organizationId)
  requirePrincipals(i.issuerUserId, i.outgoingUserId)
  const offices = (await exec.query<Row>(
    `SELECT id::text AS id FROM ue_authority_mandates WHERE organization_id = $1 AND principal_user_id = $2 AND kind = 'executive_office' AND revoked_at IS NULL`,
    [i.organizationId, i.outgoingUserId],
  )).rows.map((r) => String(r.id))
  const delegations = (await exec.query<Row>(
    `SELECT id::text AS id FROM ue_authority_delegations WHERE organization_id = $1 AND delegator_user_id = $2 AND revoked_at IS NULL`,
    [i.organizationId, i.outgoingUserId],
  )).rows.map((r) => String(r.id))
  for (const d of delegations) await revokeDelegationGoverned(exec, deps, { organizationId: i.organizationId, issuerUserId: i.issuerUserId, delegationId: d })
  for (const m of offices) await changeMandate(exec, deps, { organizationId: i.organizationId, issuerUserId: i.issuerUserId, mandateId: m, change: 'revoke' })
  const issued = await issueMandate(exec, deps, { ...i.incoming, organizationId: i.organizationId, issuerUserId: i.issuerUserId, kind: 'executive_office' })
  return { revokedMandates: offices, revokedDelegations: delegations, mandateId: issued.mandateId }
}
