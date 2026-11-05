/**
 * POST /api/finance/allocation/run — Execute an allocation run
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { AllocationRunError, runAllocation } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

// A run allocates to the organization's locals: a bounded list, so a request cannot ask for unbounded work in one transaction.
const MAX_LOCALS = 1000;

const runSchema = z.object({
  billingPeriodId: z.guid(),
  ruleId: z.guid(),
  localBasisData: z.array(z.object({
    localId: z.guid(),
    memberCount: z.number().int().min(0),
    revenue: z.string().optional(),
    budgetWeight: z.string().optional(),
    manualPercent: z.string().optional(),
  })).max(MAX_LOCALS),
});

// The run reads the organization's rules, periods and cost ledger and posts its lines in one transaction: it runs in the caller
// organization's tenant transaction, so every statement of the engine carries the organization row-level security applies to.
export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'allocation_engine',
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Execute an allocation run' },
  },
  async ({ request, organizationId, userId }) => {
    let rawBody: any;
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
        organizationId: organizationId!,
        billingPeriodId: parsed.data.billingPeriodId,
        ruleId: parsed.data.ruleId,
        localBasis: parsed.data.localBasisData as any as Parameters<typeof runAllocation>[0]['localBasis'],
        isSimulation: false,
        createdBy: userId!,
      });
      return standardSuccessResponse(result);
    } catch (error) {
      if (error instanceof AllocationRunError) {
        return standardErrorResponse(error.kind === 'not_found' ? ErrorCode.NOT_FOUND : ErrorCode.CONFLICT, error.message);
      }
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Allocation run failed', error);
    }
  },
);
