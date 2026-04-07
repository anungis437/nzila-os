/**
 * POST /api/finance/simulation — Run an allocation simulation (no writes)
 *
 * Identical to allocation/run but with isSimulation=true.
 * No ledger entries, chargebacks, or audit records are created.
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

const simulationSchema = z.object({
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = simulationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const result = await runAllocation({
      organizationId,
      billingPeriodId: parsed.data.billingPeriodId,
      ruleId: parsed.data.ruleId,
      localBasis: parsed.data.localBasisData as unknown as Parameters<typeof runAllocation>[0]['localBasis'],
      isSimulation: true,
      createdBy: userId,
    });
    return standardSuccessResponse({ simulation: true, ...result });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Simulation failed', error);
  }
});
