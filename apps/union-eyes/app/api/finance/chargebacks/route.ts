/**
 * GET /api/finance/chargebacks — List chargebacks for org (optionally filter by local)
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { getChargebacks } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

// A malformed id is a client error here, never a database fault handed back as a 500.
const querySchema = z.object({
  localId: z.guid().optional(),
  periodId: z.guid().optional(),
});

export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    query: querySchema,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'List chargebacks of the current organization' },
  },
  async ({ organizationId, query }) => {
    try {
      const chargebacks = await getChargebacks({ organizationId: organizationId!, localId: query.localId, billingPeriodId: query.periodId });
      return standardSuccessResponse(chargebacks);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch chargebacks', error);
    }
  },
);
