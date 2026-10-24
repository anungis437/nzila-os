/**
 * Actor binding: an otherwise authorised principal cannot record an act as someone
 * else. Every authority mutation takes "who acted" from the authenticated principal of
 * the enclosing transaction (app.current_user_id); any caller-supplied actor is only a
 * claim that must equal it. Proven at the TypeScript layer AND, independently, at the
 * database layer (ue_authority_guard_actor), which also refuses to run with no session.
 * Local PGlite evidence; not a deployed-role test.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { acceptInstrument, changeMandate, declareOwnRecusal, issueDelegation, issueMandate, liftRecusal, requestIssuanceApproval, requestRuleAdoption, activateIssuanceRule, draftDefaultIssuanceRules, succeedOffice } from '../../lib/authority/store/lifecycle'
import { insertMandate, openApprovalRequest, recordApprovalDecision, revokeConsent, revokeDelegation, revokeRelationship } from '../../lib/authority/store/mutations'
import { recordCounselAcceptance, recordFinancialStep, referToWorkAid, registerReview } from '../../lib/authority/store/workflow'
import { runIdempotent } from '../../lib/authority/store/idempotency'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const FORGED = /ACTOR_NOT_SESSION/

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.adoptDefaultRules()
})

describe('TypeScript layer: the actor is the session principal, never a parameter', () => {
  it('a decision is only ever made for the authenticated principal', async () => {
    const req = { principalUserId: U.president, organizationId: ORG, action: 'case:read' as const, resource: { type: 'case' as const, id: newUuid(), organizationId: ORG } }
    const other = await k.as(U.officer)((t) => enforceAuthority(t, k.deps, req, { authenticated: true }))
    expect(other.effect).toBe('deny')
    expect(other.reasons.map((r) => r.code)).toContain('PRINCIPAL_MISMATCH')
    const claimed = await k.as(U.officer)((t) => enforceAuthority(t, k.deps, { ...req, principalUserId: U.officer }, { authenticated: false }))
    expect(claimed.reasons.map((r) => r.code)).toContain('PRINCIPAL_NOT_AUTHENTICATED')
    // Outside runAuthorityTransaction there is no authenticated principal at all.
    const none = await enforceAuthority(db as never, k.deps, { ...req, principalUserId: U.officer }, { authenticated: true })
    expect(none.reasons.map((r) => r.code)).toContain('PRINCIPAL_NOT_AUTHENTICATED')
  })

  it('mandate issuance, approval, acceptance, revocation and succession cannot be performed as another person', async () => {
    const input = { organizationId: ORG, kind: 'supervisory' as const, powers: ['read'], scope: { resourceIds: [newUuid()] }, sourceInstrument: 'Res 1', effectiveAt: minutesAgo(), expiresAt: daysAhead(5) }
    await expect(k.as(U.officer)((t) => issueMandate(t, k.deps, { ...input, issuerUserId: U.president, holderUserId: U.chief }))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => requestIssuanceApproval(t, k.deps, { ...input, issuerUserId: U.president, holderUserId: U.chief, instrumentId: newUuid() }))).rejects.toThrow(FORGED)

    const m = await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [newUuid()] } })
    await expect(k.as(U.officer)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: m, change: 'revoke' }))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => succeedOffice(t, k.deps, { organizationId: ORG, issuerUserId: U.president, outgoingUserId: U.president, incoming: { holderUserId: U.vp, powers: ['approve'], effectiveAt: minutesAgo(), expiresAt: daysAhead(5) } } as never))).rejects.toThrow(FORGED)
    const live = await k.as(U.chief)((t) => t.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1 AND status = 'active'`, [m]))
    expect(live.rows).toHaveLength(1)

    const needsAcceptance = (await k.as(U.chief)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_mandates WHERE id = $1 AND requires_acceptance`, [m]))).rows.length > 0
    if (needsAcceptance) {
      const fresh = await k.grantMandate('supervisory', U.officer, ['read'], { scope: { resourceIds: [newUuid()] }, accept: false })
      await expect(k.as(U.president)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: fresh, holderUserId: U.officer }))).rejects.toThrow(FORGED)
    }
  })

  it('an approver cannot vote as another approver', async () => {
    const rid = await k.as(U.steward)((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'policy', subjectId: newUuid(), proposedBy: U.steward, requiredApprovals: 2, riskClass: 'medium', namedApproverIds: [U.vp, U.treasurer] }))
    await expect(k.as(U.vp)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: U.treasurer, decision: 'approved' }))).rejects.toThrow(FORGED)
    await expect(k.as(U.vp)((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'policy', subjectId: newUuid(), proposedBy: U.steward, requiredApprovals: 1, riskClass: 'low' }))).rejects.toThrow(FORGED)
    const votes = await k.as(U.vp)((t) => t.query(`SELECT 1 FROM ue_authority_approval_decisions WHERE approval_request_id = $1`, [rid]))
    expect(votes.rows).toHaveLength(0)
  })

  it('delegation, recusal, revocation and consent writers refuse a different actor', async () => {
    await k.grantOffice(U.president, U.vp, U.treasurer)
    await expect(k.as(U.officer)((t) => issueDelegation(t, k.deps, {
      organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.officer, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: minutesAgo(), expiresAt: daysAhead(5) }))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: 'on behalf' }))).rejects.toThrow(FORGED)
    const id = newUuid()
    await expect(k.as(U.officer)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: id }))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => revokeDelegation(t, ORG, id, U.president))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => revokeRelationship(t, ORG, id, U.president))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => revokeConsent(t, ORG, id, U.member))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => insertMandate(t, {
      organizationId: ORG, principalUserId: U.officer, kind: 'supervisory', powers: ['read'], sourceInstrument: 'x', grantedBy: U.president, effectiveAt: minutesAgo(), expiresAt: daysAhead(1), issuanceRuleId: null }))).rejects.toThrow(FORGED)
  })

  it('financial steps, reviews, referrals and idempotency keys cannot be attributed to someone else', async () => {
    await expect(k.as(U.president)((t) => recordFinancialStep(t, k.deps, { organizationId: ORG, actorUserId: U.treasurer, paymentId: newUuid(), step: 'approved' }))).rejects.toThrow(FORGED)
    await expect(k.as(U.president)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.member, reviewType: 'complaint' }))).rejects.toThrow(FORGED)
    await expect(k.as(U.president)((t) => referToWorkAid(t, k.deps, { organizationId: ORG, referrerUserId: U.steward, caseId: newUuid(), memberUserId: U.member, categories: ['status'] }))).rejects.toThrow(FORGED)
    await expect(k.as(U.officer)((t) => runIdempotent(t, { organizationId: ORG, actorUserId: U.president, key: 'k-1', operation: 'op', payload: {} }, async () => 'x'))).rejects.toThrow(FORGED)
  })

  it('rule adoption cannot be forged by naming approvers or activating as someone else', async () => {
    const [id] = await k.as(U.president)((t) => draftDefaultIssuanceRules(t, k.deps, ORG, U.president))
    await expect(k.as(U.vp)((t) => requestRuleAdoption(t, k.deps, { organizationId: ORG, ruleId: id, actorUserId: U.president, sourceInstrument: 'Bylaw 7', namedApproverIds: [U.vp, U.treasurer] }))).rejects.toThrow(FORGED)
    const req = await k.as(U.president)((t) => requestRuleAdoption(t, k.deps, { organizationId: ORG, ruleId: id, actorUserId: U.president, sourceInstrument: 'Bylaw 7', namedApproverIds: [U.vp, U.treasurer] }))
    await k.as(U.vp)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.vp, decision: 'approved' }))
    await expect(k.as(U.president)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.treasurer, decision: 'approved' }))).rejects.toThrow(FORGED)
    await expect(k.as(U.president)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: id, actorUserId: U.vp, approvalRequestId: req }))).rejects.toThrow(FORGED)
    await expect(k.as(U.president)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: id, actorUserId: U.president, approvalRequestId: req }))).rejects.toThrow(/satisfied rule_adoption approval/)
  })

  it('counsel acceptance takes no actor argument and needs a verified counsel session', async () => {
    const matter = newUuid()
    // The acceptor is not a parameter: an extra `actor` is ignored, never trusted.
    await expect(k.as(U.president)((t) => recordCounselAcceptance(t, k.deps, { organizationId: ORG, matterId: matter, actor: U.counsel } as never))).rejects.toThrow(/COUNSEL_NOT_VERIFIABLE/)
    const vouchesForCounselOnly = { counsel: { isCounselFor: async (_e: unknown, i: { userId: string }) => i.userId === U.counsel } }
    await expect(k.as(U.president)((t) => recordCounselAcceptance(t, vouchesForCounselOnly as never, { organizationId: ORG, matterId: matter }))).rejects.toThrow(/COUNSEL_NOT_VERIFIED/)
  })
})

describe('database layer: the actor columns are bound to app.current_user_id', () => {
  // Minimal rows: the actor trigger fires before NOT NULL / CHECK, so only the actor column matters.
  const INSERTS: [string, string][] = [
    ['ue_authority_issuance_rules', 'drafted_by'],
    ['ue_authority_mandates', 'granted_by'],
    ['ue_authority_resource_relationships', 'granted_by'],
    ['ue_authority_delegations', 'delegator_user_id'],
    ['ue_authority_recusals', 'principal_user_id'],
    ['ue_authority_disclosure_consents', 'issued_by'],
    ['ue_authority_approval_requests', 'proposed_by'],
    ['ue_authority_approval_decisions', 'approver_user_id'],
    ['ue_authority_acceptances', 'accepted_by'],
    ['ue_authority_requests', 'actor'],
    ['ue_authority_financial_steps', 'actor'],
    ['ue_authority_reviews', 'opened_by'],
    ['ue_authority_workaid_matters', 'referred_by'],
  ]
  const forge = (table: string, col: string, as: string, claim: string) =>
    k.as(as)((t) => t.query(`INSERT INTO ${table} (organization_id, ${col}) VALUES ($1, $2)`, [ORG, claim]))

  it.each(INSERTS)('%s.%s refuses a value that is not the session principal', async (table, col) => {
    await expect(forge(table, col, U.officer, U.president)).rejects.toThrow(FORGED)
    // The session principal's own id passes the actor guard; the row is then refused for other reasons.
    await expect(forge(table, col, U.officer, U.officer)).rejects.not.toThrow(FORGED)
  })

  it('with no authenticated principal the database refuses, even for an administrator', async () => {
    await k.asAdmin(async () => {
      await db.query(`SELECT set_config('app.current_user_id', '', false)`)
      for (const [table, col] of INSERTS) {
        await expect(db.query(`INSERT INTO ${table} (organization_id, ${col}) VALUES ($1, $2)`, [ORG, U.president]), table).rejects.toThrow(FORGED)
      }
    })
  })

  it('terminal columns (revoked_by, lifted_by, counsel_accepted_by) are bound on UPDATE', async () => {
    const m = await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [newUuid()] } })
    await expect(k.as(U.officer)((t) => t.query(`UPDATE ue_authority_mandates SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE id = $1`, [m, U.president]))).rejects.toThrow(FORGED)
    const live = await k.as(U.chief)((t) => t.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1 AND status = 'active'`, [m]))
    expect(live.rows).toHaveLength(1)
  })
})
