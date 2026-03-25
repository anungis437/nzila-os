/**
 * GET /api/finance/chargebacks — List chargebacks for org (optionally filter by local)
 */

import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { getChargebacks } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { organizationId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  try {
    const url = new URL(request.url);
    const localId = url.searchParams.get('localId') ?? undefined;
    const periodId = url.searchParams.get('periodId') ?? undefined;
    const chargebacks = await getChargebacks(organizationId, localId, periodId);
    return standardSuccessResponse(chargebacks);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch chargebacks', error);
  }
});
