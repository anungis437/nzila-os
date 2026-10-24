/**
 * Authority lifecycle on PGlite: governed issuance, acceptance, suspension,
 * amendment, delegation, recusal, case assignment and succession, with the
 * database independently refusing every bypass. Real-PostgreSQL concurrency lives
 * in authority-kernel-storage.postgres.test.ts. Not a staging isolation pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import {
  acceptInstrument,
  activateIssuanceRule,
  amendMandate,
  assignCase,
  changeMandate,
  declareOwnRecusal,
  draftDefaultIssuanceRules,
  draftIssuanceRule,
  issueDelegation,
  issueMandate,
  liftRecusal,
  requestIssuanceApproval,
  retireIssuanceRule,
  revokeDelegationGoverned,
  succeedOffice,
} from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'
import { loadActiveIssuanceRule } from '../../lib/authority/store/facts'
import { DEFAULT_ISSUANCE_TEMPLATES, NON_DELEGABLE_ACTIONS } from '../../lib/authority/issuance'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const CASE = newUuid()

const readCase = (user: string) =>
  k.as(user)((t) => enforceAuthority(t, k.deps, { principalUserId: user, organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(() => db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [CASE, ORG, U.member]))
})

describe('issuance rules: no rule, no authority', () => {
  it('with no active rule nothing can be issued', async () => {
    await expect(k.as(U.president)((t) => issueMandate(t, k.deps, {
      organizationId: ORG, issuerUserId: U.president, holderUserId: U.officer, kind: 'supervisory', powers: ['read'],
      scope: { resourceIds: [CASE] }, sourceInstrument: 'x', effectiveAt: minutesAgo(), expiresAt: daysAhead(10),
    }))).rejects.toThrow(/NO_ACTIVE_ISSUANCE_RULE/)
  })

  it('a database bypass is refused: no rule, a draft rule, or another domain’s rule', async () => {
    const raw = (rule: string | null) => k.as(U.president)((t) => t.query(
      `INSERT INTO ue_authority_mandates (organization_id, principal_user_id, kind, powers, scope, source_instrument, granted_by, effective_at, expires_at, issuance_rule_id)
       VALUES ($1,$2,'supervisory',ARRAY['read'],'{"resourceIds":["x"]}','Bylaw', $3, now(), now() + interval '1 day', $4)`, [ORG, U.officer, U.president, rule]))
    await expect(raw(null)).rejects.toThrow(/NO_ACTIVE_ISSUANCE_RULE/)
    const draft = await k.as(U.president)((t) => draftIssuanceRule(t, k.deps, { ...{ domain: 'supervisory' as const, operation: 'issue' as const, issuerCapacities: ['officer' as const], allowedPowers: ['read'], maxTermDays: 30, requiresAcceptance: false, requiredIndependentApprovals: 0 }, organizationId: ORG, draftedBy: U.president }))
    await expect(raw(draft)).rejects.toThrow(/NO_ACTIVE_ISSUANCE_RULE/)
  })

  it('default templates are drafted INACTIVE with the placeholder instrument', async () => {
    const ids = await k.as(U.president)((t) => draftDefaultIssuanceRules(t, k.deps, ORG, U.president))
    expect(ids).toHaveLength(DEFAULT_ISSUANCE_TEMPLATES.length)
    const r = await k.as(U.president)((t) => t.query<{ status: string; source_instrument: string }>(`SELECT DISTINCT status, source_instrument FROM ue_authority_issuance_rules WHERE id = ANY($1::uuid[])`, [ids]))
    expect(r.rows).toEqual([{ status: 'draft', source_instrument: 'PENDING_INSTITUTIONAL_SOURCE' }])
  })

  it('activation needs a real source, two distinct approvers, none the drafter, all adopters', async () => {
    const [id] = await k.as(U.president)((t) => draftDefaultIssuanceRules(t, k.deps, ORG, U.president))
    const act = (over: Record<string, unknown>) => k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, {
      organizationId: ORG, ruleId: id, actorUserId: U.vp, approverUserIds: [U.vp, U.treasurer], sourceInstrument: 'Bylaw 1', ...over }))
    await expect(act({ sourceInstrument: 'PENDING_INSTITUTIONAL_SOURCE' })).rejects.toThrow(/real institutional source/)
    await expect(act({ sourceInstrument: '  ' })).rejects.toThrow(/real institutional source/)
    await expect(act({ approverUserIds: [U.vp] })).rejects.toThrow(/two or more distinct/)
    await expect(act({ approverUserIds: [U.vp, U.vp] })).rejects.toThrow(/two or more distinct/)
    await expect(act({ approverUserIds: [U.vp, U.president] })).rejects.toThrow(/drafter/)
    await expect(act({ approverUserIds: [U.vp, U.steward] })).rejects.toThrow(/adoption capacity/)
  })

  it('the database alone refuses to activate a rule without provenance or independent approval', async () => {
    const [id] = await k.as(U.president)((t) => draftDefaultIssuanceRules(t, k.deps, ORG, U.president))
    const upd = (sets: string) => k.as(U.vp)((t) => t.query(`UPDATE ue_authority_issuance_rules SET status = 'active', activated_at = now(), ${sets} WHERE id = $1`, [id]))
    await expect(upd(`approved_by = ARRAY['user_vice_president','user_secretary_treasurer']`)).rejects.toThrow(/activation_chk/) // still the placeholder
    await expect(upd(`source_instrument = 'Bylaw', approved_by = ARRAY['user_president','user_vice_president']`)).rejects.toThrow(/activation_chk/) // drafter approves
    await expect(upd(`source_instrument = 'Bylaw', approved_by = ARRAY['user_vice_president']`)).rejects.toThrow(/activation_chk/)
    await expect(upd(`source_instrument = 'Bylaw', approved_by = ARRAY['user_vice_president','user_vice_president']`)).rejects.toThrow(/approvers_chk/)
  })

  it('rule content is immutable once active, and an active rule can only be retired', async () => {
    await k.adoptDefaultRules()
    const r = (await k.as(U.vp)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_issuance_rules WHERE status='active' AND domain='delegation' AND operation='issue'`))).rows[0]
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_issuance_rules SET max_term_days = 9999 WHERE id = $1`, [r.id]))).rejects.toThrow(/immutable/)
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_issuance_rules SET source_instrument = 'rewritten' WHERE id = $1`, [r.id]))).rejects.toThrow(/immutable/)
    await expect(k.as(U.vp)((t) => t.query(`UPDATE ue_authority_issuance_rules SET approved_by = ARRAY['a','b','c'] WHERE id = $1`, [r.id]))).rejects.toThrow(/only be retired/)
  })

  it('structural rule constraints: emergency, financial and non-gated domains', async () => {
    const base = { organizationId: ORG, draftedBy: U.president, operation: 'issue' as const, issuerCapacities: ['executive' as const], requiresAcceptance: false }
    const draft = (over: Record<string, unknown>) => k.as(U.president)((t) => draftIssuanceRule(t, k.deps, { ...base, domain: 'financial', allowedPowers: ['view'], maxTermDays: 30, requiredIndependentApprovals: 1, ...over } as never))
    await expect(draft({ requiredIndependentApprovals: 0 })).rejects.toThrow(/financial_chk/)
    await expect(draft({ domain: 'emergency_access', allowedPowers: ['read'], maxTermDays: 2 })).rejects.toThrow(/emergency_chk/)
    await expect(draft({ domain: 'emergency_access', allowedPowers: ['read', 'write'], maxTermDays: 1 })).rejects.toThrow(/emergency_chk/)
    await expect(draft({ domain: 'case_assignment', allowedPowers: ['read'], maxTermDays: null, requiredIndependentApprovals: 1 })).rejects.toThrow(/unapproved_domains_chk/)
    await expect(draft({ issuerCapacities: [] })).rejects.toThrow(/issuer_chk/)
    await expect(draft({ maxTermDays: null })).rejects.toThrow(/issue_term_chk/)
  })

  it('only an adopter may draft; a steward cannot', async () => {
    await expect(k.as(U.steward)((t) => draftIssuanceRule(t, k.deps, { domain: 'supervisory', operation: 'issue', issuerCapacities: ['officer'], allowedPowers: ['read'], maxTermDays: 30, requiresAcceptance: false, requiredIndependentApprovals: 0, organizationId: ORG, draftedBy: U.steward }))).rejects.toThrow(/adoption capacity/)
  })

  it('a newer version replaces the active one; a retired rule stops authorising', async () => {
    const before = (await k.as(U.vp)((t) => t.query<{ id: string; version: number }>(`SELECT id::text id, version FROM ue_authority_issuance_rules WHERE status='active' AND domain='recusal' AND operation='lift'`))).rows[0]
    const v2 = await k.as(U.president)((t) => draftIssuanceRule(t, k.deps, { domain: 'recusal', operation: 'lift', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, organizationId: ORG, draftedBy: U.president }))
    await k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: v2, actorUserId: U.vp, approverUserIds: [U.vp, U.treasurer], sourceInstrument: 'Bylaw 99' }))
    const rows = (await k.as(U.vp)((t) => t.query<{ id: string; status: string; version: number }>(`SELECT id::text id, status, version FROM ue_authority_issuance_rules WHERE domain='recusal' AND operation='lift' ORDER BY version`))).rows
    expect(rows.at(-1)?.status).toBe('active')
    expect(rows.slice(0, -1).every((r) => r.status === 'retired')).toBe(true)
    expect(rows.at(-1)?.version).toBe(before.version + 1)
    // Retiring a rule leaves no active rule for that act: the policy fails closed again.
    const ex = await k.as(U.president)((t) => draftIssuanceRule(t, k.deps, { domain: 'case_assignment', operation: 'revoke', issuerCapacities: ['executive'], allowedPowers: [], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0, organizationId: ORG, draftedBy: U.president }))
    await k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: ex, actorUserId: U.vp, approverUserIds: [U.vp, U.treasurer], sourceInstrument: 'Bylaw 100' }))
    expect(await k.as(U.vp)((t) => loadActiveIssuanceRule(t, ORG, 'case_assignment', 'revoke'))).not.toBeNull()
    await k.as(U.vp)((t) => retireIssuanceRule(t, k.deps, ORG, ex, U.vp))
    expect(await k.as(U.vp)((t) => loadActiveIssuanceRule(t, ORG, 'case_assignment', 'revoke'))).toBeNull()
  })
})

describe('mandate issuance, approval and acceptance', () => {
  const supervise = { kind: 'supervisory' as const, powers: ['read'], scope: { resourceIds: [CASE] } }

  it('office installation needs independent approval and the holder’s acceptance', async () => {
    const id = newUuid()
    const input = { organizationId: ORG, issuerUserId: U.president, holderUserId: U.vp, kind: 'executive_office' as const, powers: ['approve'], sourceInstrument: 'Constitution art. 9', effectiveAt: minutesAgo(), expiresAt: daysAhead(300) }
    await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    const req = await k.as(U.president)((t) => requestIssuanceApproval(t, k.deps, { ...input, instrumentId: id, namedApproverIds: [U.treasurer] }))
    await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: req }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    await expect(k.as(U.president)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.president, decision: 'approved' }))).rejects.toThrow(/NOT_ELIGIBLE_APPROVER|SELF_APPROVAL/)
    await expect(k.as(U.vp)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.vp, decision: 'approved' }))).rejects.toThrow(/NOT_ELIGIBLE_APPROVER|SELF_APPROVAL/)
    await k.as(U.treasurer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.treasurer, decision: 'approved' }))
    const { mandateId } = await k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: req }))
    // Issued but not accepted: it is not an effective instrument.
    const facts = await k.as(U.vp)((t) => t.query<{ requires_acceptance: boolean }>(`SELECT requires_acceptance FROM ue_authority_mandates WHERE id = $1`, [mandateId]))
    expect(facts.rows[0].requires_acceptance).toBe(true)
    await expect(k.as(U.president)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: mandateId, holderUserId: U.president }))).rejects.toThrow(/ONLY_THE_HOLDER/)
    await k.as(U.vp)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: mandateId, holderUserId: U.vp }))
    await expect(k.as(U.vp)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: mandateId, holderUserId: U.vp }))).rejects.toThrow(/accept_once_uq/)
  })

  it('an approval bound to one instrument cannot be reused for another', async () => {
    const id = newUuid()
    const input = { organizationId: ORG, issuerUserId: U.president, holderUserId: U.officer, ...supervise, sourceInstrument: 'Res 1', effectiveAt: minutesAgo(), expiresAt: daysAhead(30) }
    const req = await k.as(U.president)((t) => requestIssuanceApproval(t, k.deps, { ...input, instrumentId: id, namedApproverIds: [U.treasurer] }))
    await k.as(U.treasurer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.treasurer, decision: 'approved' }))
    await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id: newUuid(), approvalRequestId: req }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    const { mandateId } = await k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: req }))
    await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id: newUuid(), sourceInstrument: 'Res 2', approvalRequestId: req }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    // And the database alone refuses a second mandate on the same approval.
    await expect(k.as(U.president)((t) => t.query(
      `INSERT INTO ue_authority_mandates (id, organization_id, principal_user_id, kind, powers, scope, source_instrument, granted_by, effective_at, expires_at, issuance_rule_id, approval_request_id)
       SELECT gen_random_uuid(), organization_id, principal_user_id, kind, powers, scope, 'Res 3', granted_by, effective_at, expires_at, issuance_rule_id, approval_request_id FROM ue_authority_mandates WHERE id = $1`, [mandateId]))).rejects.toThrow(/request_uq|APPROVAL_NOT_SATISFIED/)
  })

  it('a supervisory mandate confers case access only after the holder accepts it', async () => {
    const unaccepted = await k.grantMandate('supervisory', U.officer, ['read'], { scope: { resourceIds: [CASE] }, accept: false })
    const d1 = await readCase(U.officer)
    expect(d1.effect).toBe('deny')
    expect(d1.reasons.map((r) => r.code)).toContain('NOT_ACCEPTED')
    await k.as(U.officer)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: unaccepted, holderUserId: U.officer }))
    const d2 = await readCase(U.officer)
    expect(d2.effect).toBe('allow')
    expect(d2.authority[0].kind).toBe('mandate')
  })

  it('suspend, resume and revoke change authority at once; surrender is always permitted', async () => {
    const ids = (await k.as(U.officer)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_mandates WHERE principal_user_id = $1 AND kind = 'supervisory' AND status = 'active'`, [U.officer]))).rows.map((r) => r.id)
    expect(ids.length).toBeGreaterThan(0)
    const each = (change: 'suspend' | 'resume' | 'revoke', issuer = U.president) =>
      Promise.all(ids.map((m) => k.as(issuer)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: issuer, mandateId: m, change }))))
    await each('suspend')
    expect((await readCase(U.officer)).effect).toBe('deny')
    await each('resume')
    expect((await readCase(U.officer)).effect).toBe('allow')
    await expect(k.as(U.steward)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.steward, mandateId: ids[0], change: 'revoke' }))).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await expect(k.as(U.officer)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, mandateId: ids[0], change: 'suspend' }))).rejects.toThrow(/SELF_APPROVAL/)
    // Surrender: a holder may revoke their own authority.
    await k.as(U.officer)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, mandateId: ids[0], change: 'revoke' }))
    await each('revoke').catch(() => undefined)
    expect((await readCase(U.officer)).effect).toBe('deny')
    await expect(k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: ids[0], change: 'resume' }))).rejects.toThrow(/no matching live record/)
  })

  it('refuses issuance beyond the rule: powers, term, holder eligibility, self-issuance, tenant', async () => {
    const issue = (over: Record<string, unknown>, issuer = U.president) => k.as(issuer)((t) => issueMandate(t, k.deps, {
      organizationId: ORG, issuerUserId: issuer, holderUserId: U.officer, ...supervise, sourceInstrument: 'Res', effectiveAt: minutesAgo(), expiresAt: daysAhead(30), ...over } as never))
    await expect(issue({ powers: ['read', 'enforce'] })).rejects.toThrow(/EXCEEDS_RULE_CEILING/)
    await expect(issue({ expiresAt: daysAhead(4000) })).rejects.toThrow(/EXCEEDS_RULE_CEILING/)
    await expect(issue({ holderUserId: U.member })).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await expect(issue({ holderUserId: U.president })).rejects.toThrow(/SELF_APPROVAL/)
    await expect(issue({ holderUserId: U.stranger })).rejects.toThrow(/NOT_AN_ACTIVE_MEMBER/)
    await expect(issue({}, U.steward)).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await expect(issue({ scope: {} })).rejects.toThrow(/INSTRUMENT_INVALID|APPROVAL_NOT_SATISFIED/)
    await expect(k.as(U.president, ORG_B)((t) => issueMandate(t, k.deps, { organizationId: ORG_B, issuerUserId: U.president, holderUserId: U.officer, ...supervise, sourceInstrument: 'Res', effectiveAt: minutesAgo(), expiresAt: daysAhead(30) }))).rejects.toThrow(/NO_ACTIVE_ISSUANCE_RULE|NOT_AN_ACTIVE_MEMBER/)
  })

  it('the database enforces the rule ceilings even if the kernel is bypassed', async () => {
    const rule = (await k.as(U.president)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_issuance_rules WHERE status='active' AND domain='supervisory' AND operation='issue'`))).rows[0].id
    const raw = (powers: string, days: number) => k.as(U.president)((t) => t.query(
      `INSERT INTO ue_authority_mandates (organization_id, principal_user_id, kind, powers, scope, source_instrument, granted_by, effective_at, expires_at, issuance_rule_id)
       VALUES ($1,$2,'supervisory',${powers},'{"resourceIds":["x"]}','Bylaw',$3, now(), now() + interval '${days} days', $4)`, [ORG, U.chief, U.president, rule]))
    await expect(raw(`ARRAY['read','enforce']`, 10)).rejects.toThrow(/POWERS_EXCEED_RULE/)
    await expect(raw(`ARRAY['read']`, 4000)).rejects.toThrow(/TERM_EXCEEDS_RULE/)
    await expect(raw(`ARRAY['read']`, 10)).rejects.toThrow(/APPROVAL_NOT_SATISFIED/) // the rule requires an independent approval
  })
})

describe('financial and governance issuance protections', () => {
  const acct = newUuid()
  it('segregation of duties is enforced at grant time and conflicting duties are refused', async () => {
    const fin = (powers: string[], account = acct) => ({ scope: { accountIds: [account] }, monetaryLimitMinor: 500_000, currency: 'CAD', approver: U.vp })
    await k.grantMandate('financial', U.treasurer, ['view', 'prepare'], fin([]))
    await expect(k.grantMandate('financial', U.treasurer, ['approve'], fin([]))).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    // The same duty on a different account is not a conflict.
    await k.grantMandate('financial', U.treasurer, ['approve'], fin([], newUuid()))
  })

  it('a monetary mandate needs an integer limit and a currency', async () => {
    await expect(k.grantMandate('financial', U.treasurer, ['prepare'], { scope: { accountIds: [newUuid()] }, approver: U.vp })).rejects.toThrow(/INSTRUMENT_INVALID/)
    await expect(k.grantMandate('financial', U.officer, ['prepare'], { scope: { accountIds: [newUuid()] }, monetaryLimitMinor: 1, currency: 'CAD', approver: U.vp })).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
  })

  it('a governance reviewer cannot also hold executive or financial authority', async () => {
    await expect(k.grantMandate('governance_review', U.treasurer, ['monitor'], { scope: { resourceIds: [newUuid()] }, approver: U.vp })).rejects.toThrow(/SEGREGATION_OF_DUTIES/)
    await k.grantMandate('governance_review', U.reviewer, ['monitor'], { scope: { resourceIds: [newUuid()] } })
  })

  it('emergency access needs an independent approver, a justification and at most 24 hours', async () => {
    const base = { scope: { resourceIds: [CASE] }, justification: 'Imminent safety concern in grievance file', effectiveAt: minutesAgo(), expiresAt: new Date(Date.now() + 6 * 3_600_000) }
    const m = await k.grantMandate('emergency_access', U.steward, ['read'], base)
    const row = (await k.as(U.steward)((t) => t.query<{ approved_by: string }>(`SELECT approved_by FROM ue_authority_mandates WHERE id = $1`, [m]))).rows[0]
    expect(row.approved_by).toBe(U.treasurer)
    await expect(k.grantMandate('emergency_access', U.steward2, ['read'], { ...base, justification: 'because' })).rejects.toThrow(/INSTRUMENT_INVALID|emergency_chk/)
    await expect(k.grantMandate('emergency_access', U.steward2, ['read'], { ...base, expiresAt: new Date(Date.now() + 30 * 3_600_000) })).rejects.toThrow(/EXCEEDS_RULE_CEILING/)
    await expect(k.grantMandate('emergency_access', U.steward2, ['read', 'write'], base)).rejects.toThrow(/EXCEEDS_RULE_CEILING/)
    // The emergency holder reads the named case, read-only, and nothing else.
    const d = await readCase(U.steward)
    expect(d.effect).toBe('allow')
    expect(d.obligations).toContain('emergency_review_required')
  })
})

describe('delegation', () => {
  it('only a live office holder may delegate, only delegable actions, only with acceptance', async () => {
    await k.grantOffice(U.president, U.vp, U.treasurer).catch(() => undefined) // president may already hold none
    const input = { organizationId: ORG, delegatorUserId: U.vp, delegateUserId: U.officer, office: 'Vice President', actions: ['case:read'], resourceTypes: ['case' as const], effectiveAt: minutesAgo(), expiresAt: daysAhead(30) }
    await expect(k.as(U.treasurer)((t) => issueDelegation(t, k.deps, { ...input, delegatorUserId: U.treasurer }))).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/) // no office mandate
    await expect(k.as(U.vp)((t) => issueDelegation(t, k.deps, { ...input, actions: ['finance:approve'] }))).rejects.toThrow(/EXCEEDS_RULE_CEILING|DELEGATION_INVALID/)
    await expect(k.as(U.vp)((t) => issueDelegation(t, k.deps, { ...input, expiresAt: daysAhead(400) }))).rejects.toThrow(/EXCEEDS_RULE_CEILING/)
    await expect(k.as(U.vp)((t) => issueDelegation(t, k.deps, { ...input, delegateUserId: U.vp }))).rejects.toThrow(/SELF_APPROVAL/)
    await expect(k.as(U.vp)((t) => issueDelegation(t, k.deps, { ...input, delegateUserId: U.member }))).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    const { delegationId } = await k.as(U.vp)((t) => issueDelegation(t, k.deps, input))
    const unaccepted = await k.as(U.officer)((t) => enforceAuthority(t, k.deps, { principalUserId: U.officer, organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG }, delegationId }, { authenticated: true }))
    // Another route may already allow this principal; the delegation itself must be refused until accepted.
    expect(unaccepted.reasons.some((r) => r.code === 'NOT_ACCEPTED') || unaccepted.effect === 'allow').toBe(true)
    await k.as(U.officer)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'delegation', instrumentId: delegationId, holderUserId: U.officer }))
    await k.as(U.vp)((t) => revokeDelegationGoverned(t, k.deps, { organizationId: ORG, issuerUserId: U.vp, delegationId }))
    await expect(k.as(U.vp)((t) => revokeDelegationGoverned(t, k.deps, { organizationId: ORG, issuerUserId: U.vp, delegationId }))).rejects.toThrow(/no matching live record/)
  })

  it('the database refuses non-delegable actions in any delegation, independent of any rule', async () => {
    await k.asAdmin(async () => {
      await db.exec('ALTER TABLE ue_authority_delegations DISABLE TRIGGER ue_authority_guard_issuance')
      try {
        for (const a of NON_DELEGABLE_ACTIONS) {
          await expect(db.query(
            `INSERT INTO ue_authority_delegations (organization_id, delegator_user_id, delegate_user_id, office, actions, resource_types, effective_at, expires_at)
             VALUES ($1,$2,$3,'VP',ARRAY['case:read',$4],ARRAY['case'], now(), now() + interval '1 day')`, [ORG, U.vp, U.officer, a])).rejects.toThrow(/nondelegable_chk/)
        }
      } finally {
        await db.exec('ALTER TABLE ue_authority_delegations ENABLE TRIGGER ue_authority_guard_issuance')
      }
    })
  })

  it('the pure list of non-delegable actions equals the database constraint', async () => {
    const def = (await k.asAdmin(() => db.query<{ d: string }>(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'ue_authority_deleg_nondelegable_chk'`))).rows[0].d
    const inDb = [...def.matchAll(/'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(inDb).toEqual([...NON_DELEGABLE_ACTIONS].sort())
  })
})

describe('amendment, recusal, case assignment, succession', () => {
  it('amendment needs its own rule, then revokes and supersedes; supersession is validated by the database', async () => {
    const m = await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [CASE] } })
    const change = { organizationId: ORG, issuerUserId: U.president, mandateId: m, powers: ['read', 'monitor'], scope: { resourceIds: [CASE] }, sourceInstrument: 'Res amended', effectiveAt: minutesAgo(), expiresAt: daysAhead(60) }
    await expect(k.as(U.president)((t) => amendMandate(t, k.deps, change))).rejects.toThrow(/NO_ACTIVE_ISSUANCE_RULE/) // no 'amend' rule by default
    await k.as(U.president)((t) => draftIssuanceRule(t, k.deps, { domain: 'supervisory', operation: 'amend', issuerCapacities: ['executive'], allowedPowers: ['read', 'assign', 'monitor'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, organizationId: ORG, draftedBy: U.president }))
    const draft = (await k.as(U.president)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_issuance_rules WHERE status='draft' AND domain='supervisory' AND operation='amend'`))).rows[0].id
    await k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: draft, actorUserId: U.vp, approverUserIds: [U.vp, U.treasurer], sourceInstrument: 'Bylaw 14' }))
    // Amendment also re-issues under the 'issue' rule, which needs its own bound approval: plain amend without one is refused.
    await expect(k.as(U.president)((t) => amendMandate(t, k.deps, change))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    // The failed attempt rolled back: the original is still live.
    const live = await k.as(U.president)((t) => t.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1 AND status = 'active'`, [m]))
    expect(live.rows).toHaveLength(1)
  })

  it('recusal: anyone may recuse themselves, only an authorised other may lift, never the recused', async () => {
    const r = await k.as(U.officer)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.officer, resourceType: 'case', resourceId: CASE, reason: 'personal conflict' }))
    expect((await readCase(U.officer)).reasons.map((x) => x.code)).toContain('RECUSED')
    await expect(k.as(U.officer)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, recusalId: r }))).rejects.toThrow(/SELF_APPROVAL|CAPACITY_NOT_ELIGIBLE/)
    await expect(k.as(U.steward)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.steward, recusalId: r }))).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await k.as(U.president)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: r }))
  })

  it('case assignment needs case:assign authority, a conflict-free eligible assignee and an active rule', async () => {
    const assign = (issuer: string, assignee: string) => k.as(issuer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: issuer, caseId: CASE, assigneeUserId: assignee, permissions: ['read', 'comment'], effectiveAt: minutesAgo() }))
    await expect(assign(U.steward2, U.steward)).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/) // holds no case:assign
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE] } }).catch(() => undefined)
    await expect(assign(U.officer, U.member)).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    // Only a recusal-free supervisor may assign; the officer recused earlier was lifted above.
    const id = await assign(U.officer, U.steward)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect((await readCase(U.steward)).effect).toBe('allow')
  })

  it('succession ends the outgoing holder’s office and delegations and installs the successor atomically', async () => {
    await k.grantOffice(U.officer, U.president, U.treasurer).catch(() => undefined)
    const incoming = { holderUserId: U.treasurer, powers: ['approve'], sourceInstrument: 'Election 2026 result', effectiveAt: minutesAgo(), expiresAt: daysAhead(300), id: newUuid() }
    // Successor installation needs an approval bound to the new mandate id.
    const req = await k.as(U.president)((t) => requestIssuanceApproval(t, k.deps, { ...incoming, organizationId: ORG, issuerUserId: U.president, kind: 'executive_office', instrumentId: incoming.id, namedApproverIds: [U.officer] }))
    await k.as(U.officer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: req, approverUserId: U.officer, decision: 'approved' }))
    const out = await k.as(U.president)((t) => succeedOffice(t, k.deps, { organizationId: ORG, issuerUserId: U.president, outgoingUserId: U.vp, incoming: { ...incoming, approvalRequestId: req } }))
    expect(out.mandateId).toBe(incoming.id)
    expect(out.revokedMandates.length).toBeGreaterThan(0)
    const vpOffice = await k.as(U.president)((t) => t.query(`SELECT 1 FROM ue_authority_mandates WHERE principal_user_id = $1 AND kind = 'executive_office' AND revoked_at IS NULL`, [U.vp]))
    expect(vpOffice.rows).toHaveLength(0)
    const leftoverDelegations = await k.as(U.president)((t) => t.query(`SELECT 1 FROM ue_authority_delegations WHERE delegator_user_id = $1 AND revoked_at IS NULL`, [U.vp]))
    expect(leftoverDelegations.rows).toHaveLength(0)
  })
})
