import { requireBaseFinancialAuthority } from '@/lib/finance/base-release-boundary'
/**
 * POST /api/finance/pricing/compare — Compare all tiers for a given scenario
 *
 * Returns a side-by-side comparison of Starter/Professional/Premium/Enterprise
 * revenue at a given member count, plus optional multi-year projections.
 */

import { z } from 'zod'
import { withApi } from '@/lib/api/framework'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'
import { compareTiers, projectRevenue } from '@/services/platform-economics/pricing-calculator'

export const dynamic = 'force-dynamic'

const compareSchema = z.object({
  memberCount: z.number().int().min(1).max(10_000_000),
  regionCount: z.number().int().min(0).max(20).optional(),
  projectionYears: z.number().int().min(1).max(10).optional(),
})

export const POST = withApi(
  { auth: { minRole: 'secretary_treasurer' }, rlsOrgContext: false },
  async ({ request, userId, organizationId }) => {
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized')
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON')
    }

    const parsed = compareSchema.safeParse(rawBody)
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error)
    }

    const { memberCount, regionCount = 0, projectionYears } = parsed.data

    requireBaseFinancialAuthority()

    try {
      const comparison = compareTiers(memberCount, regionCount)

      let projections
      if (projectionYears && projectionYears > 0) {
        projections = {
          starter: projectRevenue({ memberCount, tier: 'starter', regionCount }, projectionYears),
          professional: projectRevenue(
            { memberCount, tier: 'professional', regionCount },
            projectionYears,
          ),
          premium: projectRevenue({ memberCount, tier: 'premium', regionCount }, projectionYears),
          enterprise: projectRevenue(
            { memberCount, tier: 'enterprise', regionCount },
            projectionYears,
          ),
        }
      }

      return standardSuccessResponse({
        memberCount,
        regionCount,
        comparison,
        projections: projections ?? null,
      })
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Comparison failed', error)
    }
  },
)
