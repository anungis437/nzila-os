import { describe, expect, it } from 'vitest'
import { decide } from '../kernel'
import { dutyConflicts } from '../policies/finance'
import type { Decision, FinancialTransactionFacts, Mandate, ReasonCode } from '../ontology'
import { ACCT, DAY, HOUR, NOW, ORG, ORG_B, TX_ID, U, ago, ahead, facts, mandate, membership, ref, recusal, request } from './fixtures'

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)

const tx = (over: Partial<FinancialTransactionFacts> = {}): FinancialTransactionFacts => ({
  kind: 'financial_transaction', id: TX_ID, organizationId: ORG, accountId: ACCT, amountMinor: 50_000,
  currency: 'CAD', state: 'prepared', preparedBy: U.registrar, approvals: [], requiredApprovals: 2,
  executedBy: null, reconciledBy: null, adverseUserIds: [], ...over,
})

const fin = (userId: string, powers: string[], over: Partial<Mandate> = {}): Mandate =>
  mandate({
    id: `00000000-0000-4000-8000-${String(Math.abs(userId.length * 7 + powers.join('').length)).padStart(12, '0')}`,
    principalUserId: userId, kind: 'financial', powers, scope: { accountIds: [ACCT] },
    monetaryLimitMinor: 100_000, currency: 'CAD', grantedBy: U.president, ...over,
  })

const act = (userId: string, action: Parameters<typeof request>[1], f: ReturnType<typeof facts>, t = tx(), over = {}) =>
  decide(request(userId, action, ref('financial_transaction', TX_ID), over), f, t, NOW)

const officer = (userId: string, powers: string[], mOver: Partial<Mandate> = {}, caps: Parameters<typeof facts>[1] = ['financial_officer']) =>
  facts(userId, caps, { mandates: [fin(userId, powers, mOver)] })

describe('finance — role hierarchy and titles are never inputs', () => {
  it('a Secretary-Treasurer with no mandate has no financial authority', () => {
    const f = facts(U.treasurer, ['member', 'officer', 'executive', 'financial_officer'])
    expect(codes(act(U.treasurer, 'finance:approve', f))).toContain('NO_SOURCE_OF_AUTHORITY')
  })

  it('president / admin / national officer with no mandate: denied for every duty', () => {
    for (const caps of [['executive'], ['member'], []] as const) {
      const f = facts(U.president, [...caps])
      for (const a of ['finance:view', 'finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile', 'finance:audit'] as const) {
        expect(act(U.president, a, f).effect).toBe('deny')
      }
    }
  })

  it('a financial mandate does not help a principal without a financial capacity', () => {
    const f = facts(U.officer, ['officer'], { mandates: [fin(U.officer, ['approve'])] })
    expect(codes(act(U.officer, 'finance:approve', f))).toContain('CAPACITY_NOT_ELIGIBLE')
  })
})

describe('finance — six distinct duties', () => {
  it('view does not imply prepare / approve / execute / reconcile / audit', () => {
    const f = officer(U.treasurer, ['view'])
    expect(act(U.treasurer, 'finance:view', f, tx()).effect).toBe('allow')
    for (const a of ['finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile', 'finance:audit'] as const) {
      expect(act(U.treasurer, a, f, tx()).effect).toBe('deny')
    }
  })

  it('prepare requires a draft; approve requires prepared; execute requires approved; reconcile requires executed', () => {
    const p = officer(U.treasurer, ['prepare', 'approve', 'execute', 'reconcile'])
    expect(codes(act(U.treasurer, 'finance:prepare', p, tx({ state: 'prepared' })))).toContain('STATE_NOT_ELIGIBLE')
    expect(codes(act(U.treasurer, 'finance:approve', p, tx({ state: 'draft', preparedBy: null })))).toContain('STATE_NOT_ELIGIBLE')
    expect(codes(act(U.treasurer, 'finance:execute', p, tx({ state: 'prepared' })))).toContain('STATE_NOT_ELIGIBLE')
    expect(codes(act(U.treasurer, 'finance:reconcile', p, tx({ state: 'approved' })))).toContain('STATE_NOT_ELIGIBLE')
  })

  it('allows each duty to a properly mandated, independent principal in the right state', () => {
    expect(act(U.treasurer, 'finance:prepare', officer(U.treasurer, ['prepare']), tx({ state: 'draft', preparedBy: null })).effect).toBe('allow')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx()).effect).toBe('allow')
    const approved = tx({ state: 'approved', approvals: [{ userId: U.officer, at: ago(HOUR) }, { userId: U.president, at: ago(HOUR) }] })
    expect(act(U.treasurer, 'finance:execute', officer(U.treasurer, ['execute']), approved).effect).toBe('allow')
    const executed = { ...approved, state: 'executed' as const, executedBy: U.treasurer }
    expect(act(U.auditor, 'finance:reconcile', officer(U.auditor, ['reconcile']), executed).effect).toBe('allow')
  })
})

describe('finance — segregation of duties against the actual transaction', () => {
  it('the preparer cannot approve their own transaction', () => {
    const d = act(U.registrar, 'finance:approve', officer(U.registrar, ['approve']), tx())
    expect(codes(d)).toContain('SELF_APPROVAL')
  })

  it('an approver cannot approve twice', () => {
    const d = act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx({ approvals: [{ userId: U.treasurer, at: ago(HOUR) }] }))
    expect(codes(d)).toContain('ALREADY_DECIDED')
  })

  it('the preparer or an approver cannot execute', () => {
    const approved = tx({ state: 'approved', approvals: [{ userId: U.officer, at: ago(HOUR) }, { userId: U.president, at: ago(HOUR) }] })
    expect(codes(act(U.registrar, 'finance:execute', officer(U.registrar, ['execute']), approved))).toContain('SEGREGATION_OF_DUTIES')
    expect(codes(act(U.officer, 'finance:execute', officer(U.officer, ['execute']), approved))).toContain('SEGREGATION_OF_DUTIES')
  })

  it('cannot execute until the required number of approvals is recorded', () => {
    const t = tx({ state: 'approved', approvals: [{ userId: U.officer, at: ago(HOUR) }], requiredApprovals: 2 })
    expect(codes(act(U.treasurer, 'finance:execute', officer(U.treasurer, ['execute']), t))).toContain('STATE_NOT_ELIGIBLE')
  })

  it('the executor cannot reconcile', () => {
    const t = tx({ state: 'executed', preparedBy: U.registrar, approvals: [{ userId: U.officer, at: ago(HOUR) }, { userId: U.president, at: ago(HOUR) }], executedBy: U.treasurer })
    expect(codes(act(U.treasurer, 'finance:reconcile', officer(U.treasurer, ['reconcile']), t))).toContain('SEGREGATION_OF_DUTIES')
  })

  it('an auditor must be independent of every participant', () => {
    const t = tx({ state: 'reconciled', approvals: [{ userId: U.officer, at: ago(HOUR) }, { userId: U.president, at: ago(HOUR) }], executedBy: U.treasurer, reconciledBy: U.other })
    for (const participant of [U.registrar, U.officer, U.president, U.treasurer, U.other]) {
      const f = officer(participant, ['audit'], {}, ['auditor'])
      expect(codes(act(participant, 'finance:audit', f, t))).toContain('SEGREGATION_OF_DUTIES')
    }
    expect(act(U.auditor, 'finance:audit', officer(U.auditor, ['audit'], {}, ['auditor']), t).effect).toBe('allow')
  })

  it('audit access is read-only', () => {
    const d = act(U.auditor, 'finance:audit', officer(U.auditor, ['audit'], {}, ['auditor']), tx({ state: 'reconciled' }))
    expect(d.obligations).toContain('read_only')
  })

  it('a record whose approvals include the preparer is contradictory and blocks everything', () => {
    const t = tx({ approvals: [{ userId: U.registrar, at: ago(HOUR) }] })
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), t))).toContain('FACTS_CONTRADICTORY')
  })

  it('a record with duplicate approvers or zero required approvals is contradictory', () => {
    const dup = tx({ approvals: [{ userId: U.officer, at: ago(HOUR) }, { userId: U.officer, at: ago(HOUR) }] })
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), dup))).toContain('FACTS_CONTRADICTORY')
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx({ requiredApprovals: 0 })))).toContain('FACTS_CONTRADICTORY')
  })

  it('a conflicted (adverse / recused) principal is excluded', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx({ adverseUserIds: [U.treasurer] })))).toContain('ADVERSE_PARTY')
    const f = facts(U.treasurer, ['financial_officer'], { mandates: [fin(U.treasurer, ['approve'])], recusals: [recusal({ principalUserId: U.treasurer, resource: ref('financial_transaction', TX_ID) })] })
    expect(codes(act(U.treasurer, 'finance:approve', f))).toContain('RECUSED')
  })

  it('detects incompatible duties held together over one account', () => {
    const conflicts = dutyConflicts([
      fin(U.treasurer, ['prepare', 'approve']),
      fin(U.treasurer, ['execute'], { id: '00000000-0000-4000-8000-0000000b0002' }),
      fin(U.officer, ['approve']),
      fin(U.auditor, ['audit', 'view']),
    ])
    const pairs = conflicts.filter((c) => c.principalUserId === U.treasurer).map((c) => c.duties.join('+'))
    expect(pairs).toEqual(expect.arrayContaining(['prepare+approve', 'approve+execute', 'prepare+execute']))
    expect(conflicts.some((c) => c.principalUserId === U.officer)).toBe(false)
    expect(conflicts.some((c) => c.principalUserId === U.auditor)).toBe(false)
  })
})

describe('finance — monetary authority', () => {
  it('denies an amount above the mandate limit, allows at the limit', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { monetaryLimitMinor: 49_999 }), tx()))).toContain('AMOUNT_EXCEEDS_LIMIT')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { monetaryLimitMinor: 50_000 }), tx()).effect).toBe('allow')
  })

  it('denies on currency mismatch', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { currency: 'USD' }), tx()))).toContain('CURRENCY_MISMATCH')
  })

  it('refuses a caller-supplied amount that differs from the amount on record', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx(), { amountMinor: 10 }))).toContain('INVALID_AMOUNT')
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx(), { currency: 'USD' }))).toContain('CURRENCY_MISMATCH')
  })

  it.each([[-1], [1.5], [Number.NaN], [Infinity], [2 ** 60]])('rejects the non-integer / unsafe amount %s on record', (n) => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx({ amountMinor: n })))).toContain('INVALID_AMOUNT')
  })

  it('a monetary duty without an integer limit or currency is an invalid instrument', () => {
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { monetaryLimitMinor: null }), tx()).effect).toBe('deny')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { currency: null }), tx()).effect).toBe('deny')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { monetaryLimitMinor: 1.5 }), tx()).effect).toBe('deny')
  })

  it('a mandate for another account grants nothing; no account scope is invalid', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { scope: { accountIds: ['00000000-0000-4000-8000-0000000fffff'] } }), tx()))).toContain('OUT_OF_SCOPE')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { scope: {} }), tx()).effect).toBe('deny')
  })

  it('expired or revoked financial mandates grant nothing', () => {
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { expiresAt: ago(1) }), tx()).effect).toBe('deny')
    expect(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve'], { status: 'revoked', revokedAt: ago(1) }), tx()).effect).toBe('deny')
  })

  it('FOREIGN TENANT: a transaction in another organization is denied', () => {
    const f = officer(U.treasurer, ['approve'])
    const d = decide(request(U.treasurer, 'finance:approve', ref('financial_transaction', TX_ID, ORG_B)), f, tx({ organizationId: ORG_B }), NOW)
    expect(codes(d)).toContain('FOREIGN_TENANT')
  })

  it('financial duties cannot be delegated', () => {
    expect(codes(act(U.treasurer, 'finance:approve', officer(U.treasurer, ['approve']), tx(), { delegationId: '00000000-0000-4000-8000-000000000950' }))).toContain('DELEGATION_INVALID')
  })
})

describe('finance — member financial records', () => {
  const rec = (subject: string, accountId: string | null = ACCT) => ({ kind: 'member_financial_record' as const, id: '00000000-0000-4000-8000-0000000c0001', organizationId: ORG, subjectUserId: subject, accountId })
  const view = (userId: string, f: ReturnType<typeof facts>, subject: string) =>
    decide(request(userId, 'finance:view', ref('member_financial_record', '00000000-0000-4000-8000-0000000c0001')), f, rec(subject), NOW)

  it('a member sees their own record and no one else\'s', () => {
    expect(view(U.member, facts(U.member, ['member']), U.member).effect).toBe('allow')
    expect(view(U.member, facts(U.member, ['member']), U.other).effect).toBe('deny')
  })

  it('an officer sees member records only through a financial mandate on that account', () => {
    expect(view(U.treasurer, facts(U.treasurer, ['financial_officer']), U.member).effect).toBe('deny')
    expect(view(U.treasurer, officer(U.treasurer, ['view']), U.member).effect).toBe('allow')
  })

  it('only view applies to member records', () => {
    const d = decide(request(U.treasurer, 'finance:approve', ref('member_financial_record', '00000000-0000-4000-8000-0000000c0001')), officer(U.treasurer, ['approve']), rec(U.member), NOW)
    expect(codes(d)).toContain('ACTION_NOT_COVERED')
  })
})

void DAY; void ahead; void membership
