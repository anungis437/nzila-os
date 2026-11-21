import { requireBaseFinancialAuthority } from '@/lib/finance/base-release-boundary'
/**
 * GET /api/dues/late-fees — List overdue invoices with late fee info
 */

import { withApi, ApiError } from '@/lib/api/framework'
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority'
import { db } from '@/db'
import { platformInvoices } from '@/db/schema'
import { eq, and, lt, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    rlsOrgContext: false,
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },

    openapi: {
      tags: ['Dues'],
      summary: 'List overdue invoices eligible for late fees',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required')

    requireBaseFinancialAuthority()

    const overdueInvoices = await db
      .select()
      .from(platformInvoices)
      .where(
        and(
          eq(platformInvoices.organizationId, organizationId),
          inArray(platformInvoices.status, ['issued', 'overdue']),
          lt(platformInvoices.dueDate, new Date()),
        ),
      )
    return { overdueInvoices }
  },
)
