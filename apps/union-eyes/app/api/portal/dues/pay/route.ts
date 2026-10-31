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
import { eq, and, desc, sql } from 'drizzle-orm'
import { withApi, ApiError, RATE_LIMITS } from '@/lib/api/framework'
import { listPage } from '@/lib/api/list-page'
import { stripe } from '@/lib/stripe'
import { DuesInitiationError, initiateDuesPayment, DUES_PAYMENT_KIND } from '@/lib/dues/dues-payment-service'
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

    // A non-numeric limit is the default: NaN never reaches the query.
    const page = listPage(req, 100, 20)

    // The organization comes from the client; only a live canonical member may read its ledger.
    try {
      await requireUserForOrganization(orgId)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { payments, attempts } = await withRLSContext({ organizationId: orgId }, async () => {
      const payments = await db
        .select({
          id: memberDuesLedger.id,
          type: memberDuesLedger.transactionType,
          amount: memberDuesLedger.amount,
          balanceAfter: memberDuesLedger.balanceAfter,
          date: memberDuesLedger.transactionDate,
          description: memberDuesLedger.description,
          paymentMethod: memberDuesLedger.paymentMethod,
          receiptNumber: memberDuesLedger.receiptNumber,
          status: memberDuesLedger.status,
        })
        .from(memberDuesLedger)
        // Payment history is payments: charges, credits, adjustments and write-offs are the ledger, and the processor's own
        // payment reference is not a member-facing field.
        .where(and(eq(memberDuesLedger.userId, userId), eq(memberDuesLedger.organizationId, orgId), eq(memberDuesLedger.transactionType, 'payment')))
        .orderBy(desc(memberDuesLedger.transactionDate), desc(memberDuesLedger.id))
        .limit(page.limit)
        .offset(page.offset)

      // Initiated payments are not ledger entries until a verified provider event settles them.
      // Expose a separate bounded attempt history so the member can see pending/failed/cancelled
      // outcomes without misrepresenting an attempted charge as a posted payment.
      const result = (await db.execute(sql`SELECT id::text AS id, amount::text AS amount,
              status, created_at AS "createdAt"
          FROM dues_transactions
          WHERE organization_id = ${orgId}::uuid AND member_id = ${userId}
            AND transaction_type = 'payment'
            AND metadata->>'kind' = ${DUES_PAYMENT_KIND}
            AND status IN ('pending', 'failed', 'cancelled')
          ORDER BY created_at DESC, id DESC
          LIMIT ${page.limit} OFFSET ${page.offset}`)) as unknown
      const attempts = Array.isArray(result)
        ? result
        : ((result as { rows?: unknown[] } | null)?.rows ?? [])
      return { payments, attempts }
    })

    return NextResponse.json({ success: true, data: { payments, attempts } })
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
        gateway: stripe as unknown as Parameters<typeof initiateDuesPayment>[0]['gateway'],
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
