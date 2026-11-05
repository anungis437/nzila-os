/**
 * Finance source readiness: the kernel authorizes money movement only where an authoritative transaction source with
 * amount, currency and payer exists. Where it does not, finance actions stay UNAVAILABLE with an exact reason; they are
 * never simulated. Not a staging pass.
 */
import { describe, expect, it } from 'vitest'
import { newUuid, ORG, U } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { financeSourceReadiness, PAYMENT_SOURCE_COLUMNS } from '../../lib/authority/store/resources'
import { recordFinancialStep } from '../../lib/authority/store/workflow'

describe('finance source readiness', () => {
  it('is ready when payments carries the amount, currency and payer the finance policy needs', async () => {
    const db = await freshDb()
    const k = kit(db)
    const r = await k.as(U.treasurer)((t) => financeSourceReadiness(t))
    expect(r).toEqual({ ready: true, missingColumns: [] })
    expect(PAYMENT_SOURCE_COLUMNS).toContain('amount')
  })

  it('on the Django-first stub it reports exactly what is missing, registration refuses, and every finance decision denies', async () => {
    const db = await freshDb()
    const k = kit(db)
    const PAY = newUuid()
    await k.asAdmin(async () => {
      await db.exec(`ALTER TABLE public.payments DROP COLUMN amount, DROP COLUMN currency, DROP COLUMN member_id`)
      await db.query(`INSERT INTO public.payments (id, organization_id) VALUES ($1,$2)`, [PAY, ORG])
    })
    expect(await k.as(U.treasurer)((t) => financeSourceReadiness(t))).toEqual({ ready: false, missingColumns: ['amount', 'currency', 'member_id'] })
    await expect(
      k.as(U.treasurer)((t) => recordFinancialStep(t, k.deps, { organizationId: ORG, actorUserId: U.treasurer, paymentId: PAY, step: 'registered', accountId: newUuid(), requiredApprovals: 1 })),
    ).rejects.toThrow(/FINANCE_SOURCE_UNAVAILABLE.*amount, currency, member_id/)
    for (const action of ['finance:view', 'finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile'] as const) {
      for (const who of [U.president, U.treasurer, U.member]) {
        const d = await k.as(who)((t) => enforceAuthority(t, k.deps, { principalUserId: who, organizationId: ORG, action, resource: { type: 'financial_transaction', id: PAY, organizationId: ORG } }, { authenticated: true }))
        expect(d.effect, `${who} ${action}`).toBe('deny')
      }
    }
  })
})
