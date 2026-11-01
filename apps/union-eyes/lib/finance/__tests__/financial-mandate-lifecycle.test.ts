import { describe, expect, it } from 'vitest'
import { assertFinancialSegregation, financialMandatePhase, FinancialMandateLifecycleError, listExpiredFinancialMandates } from '../financial-mandate-lifecycle'
import { assertLiveFinancialMandate } from '@/lib/authority/store/finance-route-adapter'
import type { SqlExecutor } from '@/lib/authority/store/executor'

const ORG = '11111111-1111-4111-8111-111111111111'
const issuer = 'issuer-1'
const holder = 'holder-1'
const approver = 'approver-1'

describe('financial mandate lifecycle', () => {
  it('requires three different people to issue a financial mandate', () => {
    expect(() => assertFinancialSegregation({ issuerUserId: issuer, holderUserId: holder, approverUserId: approver })).not.toThrow()
    for (const parties of [
      { issuerUserId: issuer, holderUserId: issuer, approverUserId: approver },
      { issuerUserId: issuer, holderUserId: holder, approverUserId: issuer },
      { issuerUserId: issuer, holderUserId: holder, approverUserId: holder },
    ]) {
      expect(() => assertFinancialSegregation(parties)).toThrow(FinancialMandateLifecycleError)
    }
  })

  it('treats a past term as expired and not live', () => {
    const now = new Date('2026-10-26T16:00:00Z')
    expect(financialMandatePhase({ status: 'active', effectiveAt: new Date('2026-10-01'), expiresAt: new Date('2026-10-20') }, now)).toBe('expired')
    expect(financialMandatePhase({ status: 'active', effectiveAt: new Date('2026-10-01'), expiresAt: new Date('2026-12-01') }, now)).toBe('live')
    expect(financialMandatePhase({ status: 'active', revokedAt: now, effectiveAt: new Date('2026-10-01'), expiresAt: new Date('2026-12-01') }, now)).toBe('revoked')
    expect(financialMandatePhase({ status: 'suspended', effectiveAt: new Date('2026-10-01'), expiresAt: new Date('2026-12-01') }, now)).toBe('suspended')
  })

  it('answers FINANCIAL_MANDATES_NOT_ISSUED when the organization has no live financial mandate', async () => {
    const exec = (n: number): SqlExecutor => ({ query: async () => ({ rows: [{ n }] }) })
    await expect(assertLiveFinancialMandate(exec(0), ORG)).rejects.toMatchObject({ code: 'FINANCIAL_MANDATES_NOT_ISSUED' })
    await expect(assertLiveFinancialMandate(exec(2), ORG)).resolves.toBeUndefined()
    await expect(assertLiveFinancialMandate(exec(1), 'not-a-uuid')).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('lists expired financial mandates with a select and does not update them', async () => {
    const texts: string[] = []
    const exec: SqlExecutor = {
      query: async (text) => {
        texts.push(text)
        return { rows: [{ id: 'm1' }] }
      },
    }
    await expect(listExpiredFinancialMandates(exec, ORG)).resolves.toEqual(['m1'])
    expect(texts[0]).toMatch(/SELECT/i)
    expect(texts[0]).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/i)
  })
})
