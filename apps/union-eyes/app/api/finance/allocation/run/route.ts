/**
 * POST /api/finance/allocation/run — Execute an allocation run
 */

import { z } from 'zod';
import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { runAllocation } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const runSchema = z.object({
  billingPeriodId: z.string().uuid(),
  ruleId: z.string().uuid(),
  localBasisData: z.array(z.object({
    localId: z.string().uuid(),
    memberCount: z.number().int().min(0),
    revenue: z.string().optional(),
    budgetWeight: z.string().optional(),
    manualPercent: z.string().optional(),
  })),
});

export const POST = withMinRole('admin', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  try {
    await requireEntitlement(organizationId, 'allocation_engine', userId);
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = runSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const result = await runAllocation({
      organizationId,
      billingPeriodId: parsed.data.billingPeriodId,
      ruleId: parsed.data.ruleId,
      localBasis: parsed.data.localBasisData as unknown as Parameters<typeof runAllocation>[0]['localBasis'],
      isSimulation: false,
      createdBy: userId,
    });
    return standardSuccessResponse(result);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Allocation run failed', error);
  }
});
