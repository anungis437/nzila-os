/**
 * Authority store — resource workflows that carry their own authority checks:
 * the financial step ledger, the governance review register and the union-side
 * WorkAid referral register.
 */
import { randomUUID } from 'node:crypto'
import { decide } from '../kernel'
import type { Action, AuthorityRequest, FinancialTransactionFacts, WorkAidMatterFacts } from '../ontology'
import { auditAuthorityMutation } from './audit'
import { assertAllowed, enforceAuthority, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, type SqlExecutor } from './executor'
import { loadAuthorityFacts, loadRelationships } from './facts'
import { requirePrincipals, requireUuids } from './mutations'
import { decimalToMinor } from './resources'

type Row = Record<string, unknown>

export type FinancialStep = 'registered' | 'prepared' | 'approved' | 'executed' | 'reconciled'

const STEP_ACTION: Record<Exclude<FinancialStep, 'registered'>, Action> = {
  prepared: 'finance:prepare',
  approved: 'finance:approve',
  executed: 'finance:execute',
  reconciled: 'finance:reconcile',
}

export interface RecordFinancialStepInput {
  organizationId: string
  actorUserId: string
  paymentId: string
  step: FinancialStep
  /** Registration only. */
  accountId?: string
  requiredApprovals?: number
}

/**
 * Registers a payment into the workflow (snapshotting its amount) or records one
 * step of it. Authority comes from the finance policy; the database then enforces
 * ordering and segregation of duties again under a row lock.
 */
export async function recordFinancialStep(exec: SqlExecutor, deps: EnforcementDeps, i: RecordFinancialStepInput): Promise<string> {
  requireUuids(i.organizationId, i.paymentId, i.accountId)
  requirePrincipals(i.actorUserId)
  const now = (deps.now ?? (() => new Date()))()
  const resource = { type: 'financial_transaction' as const, id: i.paymentId, organizationId: i.organizationId }

  let snapshot: { amountMinor: number; currency: string } | null = null
  if (i.step === 'registered') {
    if (!i.accountId || !Number.isInteger(i.requiredApprovals) || (i.requiredApprovals as number) < 1) {
      throw new AuthorityStoreError('PRECONDITION', 'registration needs an account and at least one required approval')
    }
    const p = (await exec.query<Row>(`SELECT amount::text AS amount, currency, member_id FROM public.payments WHERE organization_id = $1 AND id = $2`, [i.organizationId, i.paymentId])).rows[0]
    if (!p) throw new AuthorityStoreError('NOT_FOUND', 'payment not found in this organization')
    snapshot = { amountMinor: decimalToMinor(p.amount), currency: String(p.currency ?? '') }
    // Registration needs the same authority as preparing a draft transaction on that account.
    const facts = await loadAuthorityFacts(exec, deps.memberships, { organizationId: i.organizationId, principalUserId: i.actorUserId, authenticated: true, resource, now })
    const draft: FinancialTransactionFacts = {
      kind: 'financial_transaction', id: i.paymentId, organizationId: i.organizationId, accountId: i.accountId,
      amountMinor: snapshot.amountMinor, currency: snapshot.currency, state: 'draft', preparedBy: null, approvals: [],
      requiredApprovals: i.requiredApprovals as number, executedBy: null, reconciledBy: null,
      adverseUserIds: typeof p.member_id === 'string' && p.member_id ? [p.member_id] : [],
    }
    const req: AuthorityRequest = { principalUserId: i.actorUserId, organizationId: i.organizationId, action: 'finance:prepare', resource, amountMinor: snapshot.amountMinor, currency: snapshot.currency }
    assertAllowed(decide(req, facts, draft, now))
  } else {
    assertAllowed(
      await enforceAuthority(exec, deps, { principalUserId: i.actorUserId, organizationId: i.organizationId, action: STEP_ACTION[i.step], resource }, { authenticated: true }),
    )
  }

  const row = (
    await exec.query<Row>(
      `INSERT INTO ue_authority_financial_steps
         (organization_id, subject_type, subject_id, step, actor, account_id, required_approvals, amount_minor, currency)
       VALUES ($1,'payment',$2,$3,$4,$5,$6,$7,$8) RETURNING id::text AS id`,
      [i.organizationId, i.paymentId, i.step, i.actorUserId, i.accountId ?? null, i.step === 'registered' ? i.requiredApprovals : null, snapshot?.amountMinor ?? null, snapshot?.currency ?? null],
    )
  ).rows[0]
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: `finance.${i.step}`,
    resourceType: 'ue_authority_financial_steps',
    resourceId: id,
    details: { paymentId: i.paymentId, actor: i.actorUserId },
  })
  return id
}

// ── Review register ──────────────────────────────────────────────────────────

/**
 * Protected intake: any active member may open a review. Opening one confers no
 * authority; oversight powers come only from a governance_review mandate bound to
 * the review. Adverse parties are recorded so the kernel can exclude them.
 */
export async function registerReview(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: {
    organizationId: string
    openedBy: string
    reviewType: string
    complainantUserId?: string | null
    adverseUserIds?: readonly string[]
    classification?: 'standard' | 'privileged'
  },
): Promise<string> {
  requireUuids(i.organizationId)
  requirePrincipals(i.openedBy, i.complainantUserId, ...(i.adverseUserIds ?? []))
  const m = (await deps.memberships(exec, i.organizationId, [i.openedBy])).filter((x) => x.userId === i.openedBy && x.organizationId === i.organizationId)
  if (m.length !== 1 || m[0].status !== 'active') throw new AuthorityStoreError('DENIED', 'only an active member may open a review')
  const row = (
    await exec.query<Row>(
      `INSERT INTO ue_authority_reviews (organization_id, review_type, complainant_user_id, adverse_user_ids, classification, opened_by)
       VALUES ($1,$2,$3,$4::text[],$5,$6) RETURNING id::text AS id`,
      [i.organizationId, i.reviewType, i.complainantUserId ?? null, [...(i.adverseUserIds ?? [])], i.classification ?? 'standard', i.openedBy],
    )
  ).rows[0]
  const id = String(row.id)
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'review.open', resourceType: 'ue_authority_reviews', resourceId: id, details: { reviewType: i.reviewType, openedBy: i.openedBy } })
  return id
}

// ── WorkAid referral (union side) ────────────────────────────────────────────

/**
 * Hook for the counsel-side interface (NOT built on this branch): records that counsel
 * accepted a referral, after which the case is counsel-controlled and the union loses
 * all authority over its content. This writer records the fact; it does not decide who
 * may call it, so it must only be reachable from the counsel-side boundary.
 */
export async function recordCounselAcceptance(exec: SqlExecutor, i: { organizationId: string; matterId: string; actor: string }): Promise<void> {
  requireUuids(i.organizationId, i.matterId)
  requirePrincipals(i.actor)
  const r = await exec.query(
    `UPDATE ue_authority_workaid_matters SET counsel_accepted_at = now()
      WHERE organization_id = $1 AND id = $2 AND counsel_accepted_at IS NULL AND withdrawn_at IS NULL RETURNING id`,
    [i.organizationId, i.matterId],
  )
  if (r.rows.length !== 1) throw new AuthorityStoreError('NOT_FOUND', 'no un-accepted, un-withdrawn referral with this id')
  await auditAuthorityMutation(exec, { organizationId: i.organizationId, action: 'workaid.counsel_accept', resourceType: 'ue_authority_workaid_matters', resourceId: i.matterId, details: { actor: i.actor } })
}

/**
 * Registers the union-side referral reference once the kernel allows
 * `workaid:refer`: a live owner/assignee relationship to the case AND live
 * member-issued consent naming the categories. Counsel acceptance is recorded
 * separately, by the counsel-side interface that this branch does not build.
 */
export async function referToWorkAid(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: { organizationId: string; referrerUserId: string; caseId: string; memberUserId: string; categories: readonly string[]; matterId?: string },
): Promise<string> {
  requireUuids(i.organizationId, i.caseId, i.matterId)
  requirePrincipals(i.referrerUserId, i.memberUserId)
  const now = (deps.now ?? (() => new Date()))()
  const matterId = i.matterId ?? randomUUID()
  const resource = { type: 'workaid_matter' as const, id: matterId, organizationId: i.organizationId }
  const facts = await loadAuthorityFacts(exec, deps.memberships, { organizationId: i.organizationId, principalUserId: i.referrerUserId, authenticated: true, resource, now })
  const related = await loadRelationships(exec, i.organizationId, i.referrerUserId, 'case', i.caseId)
  const provisional: WorkAidMatterFacts = { kind: 'workaid_matter', id: matterId, organizationId: i.organizationId, memberUserId: i.memberUserId, caseId: i.caseId, counselControlled: true }
  const decision = decide(
    { principalUserId: i.referrerUserId, organizationId: i.organizationId, action: 'workaid:refer', resource, categories: i.categories },
    { ...facts, relationships: [...facts.relationships, ...related] },
    provisional,
    now,
  )
  assertAllowed(decision)
  await exec.query(
    `INSERT INTO ue_authority_workaid_matters (id, organization_id, member_user_id, case_id, referred_by) VALUES ($1,$2,$3,$4,$5)`,
    [matterId, i.organizationId, i.memberUserId, i.caseId, i.referrerUserId],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'workaid.refer',
    resourceType: 'ue_authority_workaid_matters',
    resourceId: matterId,
    details: { caseId: i.caseId, referrer: i.referrerUserId, categories: i.categories },
  })
  return matterId
}
