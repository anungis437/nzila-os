/**
 * POST /api/dues/create-payment-intent — initiate a Stripe dues payment.
 *
 * Same server-owned initiation as /api/portal/dues/pay: the client supplies no amount,
 * organization or member. The ledger is credited only by the verified Stripe webhook.
 */

import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework'
import { stripe } from '@/lib/stripe'
import { DuesInitiationError, initiateDuesPayment } from '@/lib/dues/dues-payment-service'
import { assertMemberDuesPaymentEnabled } from '@/lib/dues/member-dues-flag'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    rateLimit: RATE_LIMITS.FINANCIAL_WRITE,
    openapi: {
      tags: ['Dues'],
      summary: "Initiate a Stripe payment for the member's outstanding dues",
    },
  },
  async ({ organizationId, userId }) => {
    assertMemberDuesPaymentEnabled()
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required')
    try {
      const initiation = await initiateDuesPayment({
        organizationId,
        userId,
        gateway: stripe as unknown as Parameters<typeof initiateDuesPayment>[0]['gateway'],
        providerConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      })
      return {
        clientSecret: initiation.clientSecret,
        paymentIntentId: initiation.paymentIntentId,
        paymentId: initiation.paymentId,
        amount: initiation.amount,
        currency: initiation.currency,
      }
    } catch (error) {
      if (error instanceof DuesInitiationError) {
        if (error.code === 'NOTHING_DUE') throw ApiError.conflict(error.message)
        throw ApiError.externalService('stripe', error.message)
      }
      throw error
    }
  },
)
