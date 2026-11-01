import { describe, expect, it, vi } from 'vitest'
import type { Mandate } from '@/lib/authority/ontology'
import { ACCT, NOW, ORG, U, ago, DAY, mandate } from '@/lib/authority/__tests__/fixtures'
import { assertPrincipalFinancialAuthority, decidePrincipalFinancialAuthority, type PrincipalFinancialInput } from '../principal-financial-authority'

const REMITTANCE = '00000000-0000-4000-8000-000000000881'

function financial(over: Partial<Mandate> = {}): Mandate {
  return mandate({
    principalUserId: U.treasurer,
    kind: 'financial',
    powers: ['view', 'prepare'],
    scope: { accountIds: [ACCT], resourceIds: [ORG] },
    monetaryLimitMinor: 500_000,
    currency: 'CAD',
    acceptedAt: ago(DAY),
    ...over,
  })
}

const input = (over: Partial<PrincipalFinancialInput> = {}): PrincipalFinancialInput => ({
  organizationId: ORG,
  userId: U.treasurer,
  action: 'finance:view',
  ...over,
})

describe('principal financial authority', () => {
  it('allows the holder of a live mandate that names the ledger and the duty', () => {
    const view = decidePrincipalFinancialAuthority(input(), [financial()], NOW)
    const prepare = decidePrincipalFinancialAuthority(input({ action: 'finance:prepare', employerId: U.other }), [financial()], NOW)
    expect(view.ok && view.grant.ledgerWide).toBe(true)
    expect(prepare.ok && prepare.grant.mandateId).toBe(financial().id)
  })

  it('allows a mandate that names one remittance and no other row', () => {
    const decision = decidePrincipalFinancialAuthority(input({ resourceId: REMITTANCE }), [financial({ scope: { accountIds: [ACCT], resourceIds: [REMITTANCE] }, powers: ['view'] })], NOW)
    expect(decision.ok && decision.grant).toMatchObject({ ledgerWide: false, resourceIds: [REMITTANCE] })
  })

  it('refuses an account-only mandate as a list of every remittance', () => {
    const decision = decidePrincipalFinancialAuthority(input(), [financial({ scope: { accountIds: [ACCT] }, powers: ['view'] })], NOW)
    expect(decision).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
  })

  it('refuses a ledger read when the mandate does not name the organization', () => {
    const decision = decidePrincipalFinancialAuthority(input({ requiresLedger: true }), [financial({ scope: { accountIds: [ACCT], resourceIds: [REMITTANCE] }, powers: ['view'] })], NOW)
    expect(decision).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
  })

  it('does not treat another principal, an expired window, or the wrong power as authority', () => {
    expect(decidePrincipalFinancialAuthority(input(), [], NOW)).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
    expect(decidePrincipalFinancialAuthority(input(), [financial({ expiresAt: ago(DAY) })], NOW)).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
    expect(decidePrincipalFinancialAuthority(input({ action: 'finance:approve', resourceId: REMITTANCE }), [financial({ powers: ['view'] })], NOW)).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
    expect(decidePrincipalFinancialAuthority(input({ resourceId: U.other }), [financial({ scope: { accountIds: [ACCT], resourceIds: [REMITTANCE] }, powers: ['view'] })], NOW)).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })

  it('refuses segregation only after the duty is held', () => {
    const approver = financial({ powers: ['view', 'approve'] })
    expect(decidePrincipalFinancialAuthority(input({ action: 'finance:approve', participants: [U.treasurer] }), [approver], NOW)).toMatchObject({ ok: false, code: 'SEGREGATION_OF_DUTIES' })
    expect(decidePrincipalFinancialAuthority(input({ action: 'finance:approve', participants: [U.treasurer] }), [], NOW)).toMatchObject({ ok: false, code: 'DUTY_NOT_HELD' })
    const conflicted = [
      financial({ powers: ['view', 'prepare'] }),
      financial({ id: U.other, powers: ['view', 'approve'], sourceInstrument: 'Minute 9' }),
    ]
    expect(decidePrincipalFinancialAuthority(input({ action: 'finance:approve' }), conflicted, NOW)).toMatchObject({ ok: false, code: 'SEGREGATION_OF_DUTIES' })
    expect(decidePrincipalFinancialAuthority(input({ action: 'finance:view' }), conflicted, NOW).ok).toBe(true)
  })

  it('stops at an organization with no live financial mandate and does not load the caller', async () => {
    const query = vi.fn(async () => ({ rows: [{ n: 0 }] }))
    await expect(assertPrincipalFinancialAuthority({ query }, input())).rejects.toMatchObject({ code: 'FINANCIAL_MANDATES_NOT_ISSUED' })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('refuses an organization id that is not a uuid before any query', async () => {
    const query = vi.fn()
    await expect(assertPrincipalFinancialAuthority({ query }, input({ organizationId: 'org_1' }))).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(query).not.toHaveBeenCalled()
  })
})
