/**
 * GET  /api/finance/allocation — List allocation rules
 * POST /api/finance/allocation — Create an allocation rule
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
  getAllocationRules,
  createAllocationRule,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  costType: z.string(),
  method: z.enum([
    'per_member_count',
    'per_active_user',
    'per_case_volume',
    'per_local_flat',
    'weighted_hybrid',
    'manual_override',
    'subsidized',
  ]),
  parameters: z.record(z.unknown()).optional(),
  effectiveFrom: z.string().datetime().optional(),
});

export const GET = withMinRole('officer', async (_request, context: BaseAuthContext) => {
  const { organizationId, userId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'allocation_engine', userId);

  try {
    const rules = await getAllocationRules(organizationId);
    return standardSuccessResponse(rules);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch allocation rules', error);
  }
});

export const POST = withMinRole('admin', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'allocation_engine', userId);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = createRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const rule = await createAllocationRule({
      organizationId,
      name: parsed.data.name,
      method: parsed.data.method,
      weights: parsed.data.parameters as Record<string, number> | undefined,
      effectiveFrom: parsed.data.effectiveFrom
        ? new Date(parsed.data.effectiveFrom)
        : new Date(),
      createdBy: userId,
    });
    return standardSuccessResponse(rule);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to create allocation rule', error);
  }
});
