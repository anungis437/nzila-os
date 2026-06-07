/**
 * POST /api/finance/pricing/compare — Compare all tiers for a given scenario
 *
 * Returns a side-by-side comparison of Starter/Professional/Premium/Enterprise
 * revenue at a given member count, plus optional multi-year projections.
 */

import { z } from 'zod';
import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import {
  compareTiers,
  projectRevenue,
} from '@/services/platform-economics/pricing-calculator';

export const dynamic = 'force-dynamic';

const compareSchema = z.object({
  memberCount: z.number().int().min(1).max(10_000_000),
  regionCount: z.number().int().min(0).max(20).optional(),
  projectionYears: z.number().int().min(1).max(10).optional(),
});

export const POST = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  try {
    await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = compareSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  const { memberCount, regionCount = 0, projectionYears } = parsed.data;

  try {
    const comparison = compareTiers(memberCount, regionCount);

    let projections;
    if (projectionYears && projectionYears > 0) {
      projections = {
        starter: projectRevenue({ memberCount, tier: 'starter', regionCount }, projectionYears),
        professional: projectRevenue({ memberCount, tier: 'professional', regionCount }, projectionYears),
        premium: projectRevenue({ memberCount, tier: 'premium', regionCount }, projectionYears),
        enterprise: projectRevenue({ memberCount, tier: 'enterprise', regionCount }, projectionYears),
      };
    }

    return standardSuccessResponse({
      memberCount,
      regionCount,
      comparison,
      projections: projections ?? null,
    });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Comparison failed', error);
  }
});
