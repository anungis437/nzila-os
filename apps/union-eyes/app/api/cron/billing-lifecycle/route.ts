/**
 * POST /api/cron/billing-lifecycle
 *
 * Automates monthly billing lifecycle:
 * - ensure current billing period exists
 * - generate invoices for active subscriptions
 * - finalize draft invoices
 * - mark unpaid overdue invoices as failed lifecycle state
 */

import { withApi } from '@/lib/api/framework'
import { ApiError } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron', 'Billing'],
      summary: 'Run automated billing lifecycle scheduler',
    },
  },
  async () => {
    // Final closure sprint D1 authorizes SYSTEM cross-organization SELECT only.
    // Period creation, invoice generation and invoice state transitions are
    // cross-organization financial WRITES, which that authority does not imply,
    // and a cron caller has no human actor for a tenant RLS transaction. Fail
    // closed explicitly instead of running the lifecycle with unauthorized writes.
    throw ApiError.notImplemented(
      'Billing lifecycle automation requires SYSTEM cross-organization write authority, which is not authorized',
    )
  },
)
