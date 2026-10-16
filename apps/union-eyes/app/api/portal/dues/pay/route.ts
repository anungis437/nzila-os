/**
 * GET  /api/portal/dues/pay  — member's payment history (recent)
 * POST /api/portal/dues/pay  — initiate a Stripe dues payment
 *
 * The member cannot assert payment. This endpoint only creates a server-owned pending dues
 * payment and a Stripe PaymentIntent; the ledger is credited exclusively by the verified
 * Stripe webhook (lib/dues/dues-settlement.ts). The amount, organization and member are all
 * derived server-side.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { requireUserForOrganization } from '@/lib/api-auth-guard'
import { memberDuesLedger } from '@/db/schema/dues-finance-schema'
import { eq, and, desc } from 'drizzle-orm'
import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework'
import { stripe } from '@/lib/stripe'
import { DuesInitiationError, initiateDuesPayment } from '@/lib/dues/dues-payment-service'
import { assertMemberDuesPaymentEnabled } from '@/lib/dues/member-dues-flag'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('portal:dues:pay')

export const dynamic = 'force-dynamic'

// ── GET: recent payment history ───────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId =
      req.nextUrl.searchParams.get('organizationId') || req.headers.get('x-organization-id')
    if (!orgId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100)

    // The organization comes from the client; only a live canonical member may read its ledger.
    try {
      await requireUserForOrganization(orgId)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payments = await withRLSContext({ organizationId: orgId }, async () =>
      db
        .select({
          id: memberDuesLedger.id,
          type: memberDuesLedger.transactionType,
          amount: memberDuesLedger.amount,
          balanceAfter: memberDuesLedger.balanceAfter,
          date: memberDuesLedger.transactionDate,
          description: memberDuesLedger.description,
          paymentMethod: memberDuesLedger.paymentMethod,
          paymentReference: memberDuesLedger.paymentReference,
          receiptNumber: memberDuesLedger.receiptNumber,
          status: memberDuesLedger.status,
        })
        .from(memberDuesLedger)
        .where(and(eq(memberDuesLedger.userId, userId), eq(memberDuesLedger.organizationId, orgId)))
        .orderBy(desc(memberDuesLedger.transactionDate))
        .limit(limit),
    )

    return NextResponse.json({ success: true, data: { payments } })
  } catch (error) {
    logger.error('[portal/dues/pay] GET Error:', error instanceof Error ? error : { detail: error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment history' },
      { status: 500 },
    )
  }
}

// ── POST: initiate a server-owned Stripe dues payment ────────────
export const POST = withApi(
  {
    auth: { minRole: 'member' },
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
      return await initiateDuesPayment({
        organizationId,
        userId,
        stripe: stripe as unknown as Parameters<typeof initiateDuesPayment>[0]['stripe'],
        providerConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      })
    } catch (error) {
      if (error instanceof DuesInitiationError) {
        if (error.code === 'NOTHING_DUE') throw ApiError.conflict(error.message)
        throw ApiError.externalService('stripe', error.message)
      }
      throw error
    }
  },
)
