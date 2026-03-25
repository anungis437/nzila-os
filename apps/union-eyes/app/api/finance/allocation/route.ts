/**
 * GET  /api/finance/allocation — List allocation rules
 * POST /api/finance/allocation — Create an allocation rule
 */

import { z } from 'zod';
import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
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
    'per_capita',
    'proportional_revenue',
    'fixed_share',
    'tiered',
    'hybrid',
    'weighted_hybrid',
    'manual_override',
  ]),
  parameters: z.record(z.unknown()).optional(),
  effectiveFrom: z.string().datetime().optional(),
});

export const GET = withMinRole('officer', async (_request, context: BaseAuthContext) => {
  const { organizationId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

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
      ...parsed.data,
      createdBy: userId,
    });
    return standardSuccessResponse(rule);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to create allocation rule', error);
  }
});
