/**
 * GET  /api/finance/allocation — List allocation rules
 * POST /api/finance/allocation — Create an allocation rule
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
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
  parameters: z.record(z.string(), z.unknown()).optional(),
  effectiveFrom: z.string().datetime().optional(),
});

// The rules are the caller organization's own rows: the handler runs in that organization's tenant transaction, so the
// ambient handle the engine reads and writes through carries the organization row-level security applies to.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'allocation_engine',
    rlsOrgContext: true,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'List allocation rules' },
  },
  async ({ organizationId }) => {
    try {
      const rules = await getAllocationRules(organizationId!);
      return standardSuccessResponse(rules);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch allocation rules', error);
    }
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'allocation_engine',
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Create an allocation rule' },
  },
  async ({ request, organizationId, userId }) => {
    let rawBody: any;
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
        organizationId: organizationId!,
        name: parsed.data.name,
        method: parsed.data.method,
        weights: parsed.data.parameters as Record<string, number> | undefined,
        effectiveFrom: parsed.data.effectiveFrom
          ? new Date(parsed.data.effectiveFrom)
          : new Date(),
        createdBy: userId!,
      });
      return standardSuccessResponse(rule);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to create allocation rule', error);
    }
  },
);
