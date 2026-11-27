import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

const m = vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dues_test'
  return {
    settle: vi.fn(),
    providerOutcome: vi.fn(),
    denial: vi.fn(),
    platformFee: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
})

vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (operation: (tx: unknown) => Promise<unknown>) =>
    operation({ tx: true }),
}))
vi.mock('@/services/platform-economics', () => ({
  evaluateFee: m.platformFee,
  captureTransactionFee: vi.fn(),
  reverseTransactionFee: vi.fn(),
  reconcileExternalInvoicePayment: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: m.logger }))
vi.mock('@/lib/audit-logger', () => ({
  auditLog: vi.fn(),
  AuditEventType: { API_WEBHOOK_RECEIVED: 'api.webhook.received' },
  AuditSeverity: { LOW: 'low' },
}))
vi.mock('@/lib/hubspot/syncIcraPurchase', () => ({ syncIcraPurchase: vi.fn() }))
vi.mock('@/lib/hubspot/syncWorkbookPurchase', () => ({ syncWorkbookPurchase: vi.fn() }))
vi.mock('@/lib/icra/claim-tokens', () => ({
  generateClaimToken: vi.fn(),
  computeClaimExpiry: vi.fn(),
}))
vi.mock('@/lib/dues/dues-settlement', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dues/dues-settlement')>()),
  settleDuesPaymentIntent: m.settle,
  recordDuesPaymentProviderOutcome: m.providerOutcome,
  recordDuesSettlementDenial: m.denial,
}))

import { MEMBER_DUES_SETTLEMENT_REFUSAL } from '@/lib/dues/member-dues-flag'
import { POST } from '../payments/webhooks/stripe/route'

const duesIntent = {
  id: 'pi_dues_1',
  amount: 2500,
  currency: 'cad',
  metadata: {
    ue_payment_kind: 'member_dues',
    ue_dues_payment_id: '11111111-1111-4111-8111-111111111111',
    organization_id: '22222222-2222-4222-8222-222222222222',
    member_user_id: 'user-1',
  },
}

function request(
  type: string,
  object: unknown,
  options: { signature?: 'valid' | 'invalid' | 'missing' } = {},
) {
  const payload = JSON.stringify({ id: 'evt_1', type, data: { object } })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const mac = createHmac('sha256', 'whsec_dues_test')
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const signature = options.signature ?? 'valid'
  return new NextRequest('http://localhost/api/payments/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      ...(signature === 'missing'
        ? {}
        : { 'stripe-signature': `t=${timestamp},v1=${signature === 'valid' ? mac : 'deadbeef'}` }),
    },
  })
}

describe('stripe webhook: member dues settlement authority', () => {
  beforeEach(() => vi.clearAllMocks())

  // SYSTEM holds zero authority over dues_transactions and member_dues_ledger. A verified dues event is
  // authenticated but has no settlement path: 501, nothing settled, recorded or billed.
  it.each(['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled'])(
    'answers 501 for a verified %s dues event with no settlement, outcome or platform billing',
    async (type) => {
      const response = await POST(request(type, duesIntent))
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({
        received: false,
        error: 'NOT_IMPLEMENTED',
        message: MEMBER_DUES_SETTLEMENT_REFUSAL,
      })
      expect(m.settle).not.toHaveBeenCalled()
      expect(m.providerOutcome).not.toHaveBeenCalled()
      expect(m.denial).not.toHaveBeenCalled()
      expect(m.platformFee).not.toHaveBeenCalled()
    },
  )

  it('rejects invalid and missing signatures before anything else', async () => {
    expect(
      (await POST(request('payment_intent.succeeded', duesIntent, { signature: 'invalid' })))
        .status,
    ).toBe(401)
    expect(
      (await POST(request('payment_intent.succeeded', duesIntent, { signature: 'missing' })))
        .status,
    ).toBe(400)
    expect(m.settle).not.toHaveBeenCalled()
  })
})
