/**
 * Zonga — Subscription API Route Tests
 *
 * Tests GET /api/subscriptions and POST /api/subscriptions
 * for all action types: checkout_premium, checkout_label, portal, portal_creator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ── Mocks ── */

const mockGetListenerSubscription = vi.fn()
const mockCreateListenerPremiumCheckout = vi.fn()
const mockCreateLabelPlanCheckout = vi.fn()
const mockCreateListenerPortalSession = vi.fn()
const mockCreateCreatorPortalSession = vi.fn()

vi.mock('@/lib/actions/subscription-actions', () => ({
  getListenerSubscription: () => mockGetListenerSubscription(),
  createListenerPremiumCheckout: () => mockCreateListenerPremiumCheckout(),
  createLabelPlanCheckout: (id: string) => mockCreateLabelPlanCheckout(id),
  createListenerPortalSession: () => mockCreateListenerPortalSession(),
  createCreatorPortalSession: (id: string) => mockCreateCreatorPortalSession(id),
}))

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user_test' }),
}))

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: vi.fn().mockResolvedValue({ ok: true }),
  withRequestContext: (_req: Request, fn: () => unknown) => fn(),
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: (_name: string, _attrs: Record<string, string>, fn: () => unknown) => fn(),
}))

/* ── Import after mocks ── */

let GET: (request: Request) => Promise<Response>
let POST: (request: Request) => Promise<Response>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('../../app/api/subscriptions/route')
  GET = mod.GET
  POST = mod.POST
})

/* ── Helpers ── */

function makeGetRequest() {
  return new Request('http://localhost/api/subscriptions', { method: 'GET' })
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/* ── Tests ── */

describe('Subscription API Routes', () => {
  describe('GET /api/subscriptions', () => {
    it('returns current listener subscription', async () => {
      mockGetListenerSubscription.mockResolvedValue({
        plan: 'premium',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
        currentPeriodEnd: new Date('2025-01-01'),
      })

      const res = await GET(makeGetRequest())
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data.plan).toBe('premium')
      expect(json.data.subscriptionStatus).toBe('active')
    })

    it('returns null when no subscription exists', async () => {
      mockGetListenerSubscription.mockResolvedValue(null)

      const res = await GET(makeGetRequest())
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.data).toBeNull()
    })
  })

  describe('POST /api/subscriptions', () => {
    it('rejects requests without action', async () => {
      const res = await POST(makePostRequest({}))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('action')
    })

    it('rejects unknown actions', async () => {
      const res = await POST(makePostRequest({ action: 'unknown' }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain('Unknown action')
    })

    describe('checkout_premium', () => {
      it('returns checkout URL on success', async () => {
        mockCreateListenerPremiumCheckout.mockResolvedValue({
          url: 'https://checkout.stripe.com/session_123',
        })

        const res = await POST(makePostRequest({ action: 'checkout_premium' }))
        const json = await res.json()
        expect(json.ok).toBe(true)
        expect(json.data.url).toContain('stripe.com')
      })

      it('returns error when checkout fails', async () => {
        mockCreateListenerPremiumCheckout.mockResolvedValue({
          url: null,
          error: 'Listener profile not found',
        })

        const res = await POST(makePostRequest({ action: 'checkout_premium' }))
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toBe('Listener profile not found')
      })
    })

    describe('checkout_label', () => {
      it('requires creatorId', async () => {
        const res = await POST(makePostRequest({ action: 'checkout_label' }))
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toContain('creatorId')
      })

      it('returns checkout URL with valid creatorId', async () => {
        mockCreateLabelPlanCheckout.mockResolvedValue({
          url: 'https://checkout.stripe.com/session_456',
        })

        const res = await POST(makePostRequest({
          action: 'checkout_label',
          creatorId: 'cre_xyz',
        }))
        const json = await res.json()
        expect(json.ok).toBe(true)
        expect(json.data.url).toContain('stripe.com')
        expect(mockCreateLabelPlanCheckout).toHaveBeenCalledWith('cre_xyz')
      })
    })

    describe('portal', () => {
      it('returns portal URL on success', async () => {
        mockCreateListenerPortalSession.mockResolvedValue({
          url: 'https://billing.stripe.com/portal_123',
        })

        const res = await POST(makePostRequest({ action: 'portal' }))
        const json = await res.json()
        expect(json.ok).toBe(true)
        expect(json.data.url).toContain('stripe.com')
      })

      it('returns error when no subscription exists', async () => {
        mockCreateListenerPortalSession.mockResolvedValue({
          url: null,
          error: 'No active subscription found',
        })

        const res = await POST(makePostRequest({ action: 'portal' }))
        expect(res.status).toBe(400)
      })
    })

    describe('portal_creator', () => {
      it('requires creatorId', async () => {
        const res = await POST(makePostRequest({ action: 'portal_creator' }))
        expect(res.status).toBe(400)
        const json = await res.json()
        expect(json.error).toContain('creatorId')
      })

      it('returns portal URL with valid creatorId', async () => {
        mockCreateCreatorPortalSession.mockResolvedValue({
          url: 'https://billing.stripe.com/portal_456',
        })

        const res = await POST(makePostRequest({
          action: 'portal_creator',
          creatorId: 'cre_xyz',
        }))
        const json = await res.json()
        expect(json.ok).toBe(true)
        expect(mockCreateCreatorPortalSession).toHaveBeenCalledWith('cre_xyz')
      })
    })
  })
})
