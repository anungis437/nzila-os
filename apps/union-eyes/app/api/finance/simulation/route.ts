/**
 * POST /api/finance/simulation — Run an allocation simulation
 *
 * Identical to allocation/run but with isSimulation=true: the run is stored as a `simulated` allocation run (with its lines and
 * basis snapshots) so it can be compared, and no ledger entries, chargebacks or ledger updates are made.
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

const MAX_LOCALS = 1000;

const simulationSchema = z.object({
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

// The simulation reads the organization's rules, periods and ledger in its tenant transaction (`rlsOrgContext`); an invalid JSON body or
// input is a 400 from the wrapper, and the entitlement is checked by it before the handler.
export const POST = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    body: simulationSchema,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Run an allocation simulation (stores a simulated run; no ledger entries or chargebacks)' },
  },
  async ({ userId, organizationId, body }) => {
  try {
    const result = await runAllocation({
      organizationId: organizationId!,
      billingPeriodId: body.billingPeriodId,
      ruleId: body.ruleId,
      localBasis: body.localBasisData as unknown as Parameters<typeof runAllocation>[0]['localBasis'],
      isSimulation: true,
      createdBy: userId!,
    });
    return standardSuccessResponse({ simulation: true, ...result });
  } catch (error) {
    if (error instanceof AllocationRunError) {
      return standardErrorResponse(error.kind === 'not_found' ? ErrorCode.NOT_FOUND : ErrorCode.CONFLICT, error.message);
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Simulation failed', error);
  }
  },
);
