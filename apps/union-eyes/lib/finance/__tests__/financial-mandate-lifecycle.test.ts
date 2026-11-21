import { describe, expect, it, vi } from 'vitest'
import { ErrorCode } from '@/lib/api/errors'
import { BaseFinancialCapabilityUnavailable } from '../base-release-boundary'
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

  it('refuses with 501 NOT_IMPLEMENTED before reading any mandate, whatever the organization holds', async () => {
    const refusal = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };
    for (const [n, organizationId] of [[0, ORG], [2, ORG], [1, 'not-a-uuid']] as const) {
      const query = vi.fn(async () => ({ rows: [{ n }] }))
      const exec: SqlExecutor = { query }
      const rejected = await assertLiveFinancialMandate(exec, organizationId).then(() => null, (error: unknown) => error)
      expect(rejected).toBeInstanceOf(BaseFinancialCapabilityUnavailable)
      expect(rejected).toMatchObject(refusal)
      expect(query).not.toHaveBeenCalled()
    }
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
