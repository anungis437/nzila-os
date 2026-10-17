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

import { DuesSettlementError } from '@/lib/dues/dues-settlement'
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

  it('settles a verified dues payment intent and never runs platform billing', async () => {
    m.settle.mockResolvedValueOnce('settled')
    const response = await POST(request('payment_intent.succeeded', duesIntent))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ received: true, status: 'settled' })
    expect(m.settle).toHaveBeenCalledWith({ tx: true }, duesIntent, 'evt_1')
    expect(m.platformFee).not.toHaveBeenCalled()
  })

  it('answers a duplicate delivery without a second credit', async () => {
    m.settle.mockResolvedValueOnce('duplicate')
    const response = await POST(request('payment_intent.succeeded', duesIntent))
    expect(await response.json()).toMatchObject({ status: 'duplicate' })
  })

  it('fails closed on tampered metadata and records the denial', async () => {
    m.settle.mockRejectedValueOnce(
      new DuesSettlementError(
        'AMOUNT_MISMATCH',
        'Amount mismatch',
        duesIntent.metadata.organization_id,
        'p1',
      ),
    )
    const response = await POST(request('payment_intent.succeeded', duesIntent))
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ received: false, code: 'AMOUNT_MISMATCH' })
    expect(m.denial).toHaveBeenCalled()
  })

  it('rejects invalid and missing signatures before any settlement', async () => {
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

  it('records provider failure and cancellation without crediting', async () => {
    m.providerOutcome.mockResolvedValue('recorded')
    await POST(request('payment_intent.payment_failed', duesIntent))
    await POST(request('payment_intent.canceled', duesIntent))
    expect(m.providerOutcome).toHaveBeenNthCalledWith(
      1,
      { tx: true },
      duesIntent,
      'evt_1',
      'failed',
    )
    expect(m.providerOutcome).toHaveBeenNthCalledWith(
      2,
      { tx: true },
      duesIntent,
      'evt_1',
      'cancelled',
    )
    expect(m.settle).not.toHaveBeenCalled()
  })
})
