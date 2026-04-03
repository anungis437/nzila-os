/**
 * POST /api/ai/grievances/[id]/clause-reasoning
 * AI-powered clause reasoning analysis for a specific grievance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { suggestClausesForGrievance } from '@/lib/ai/clause-reasoning';

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  if (!organizationId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
  }

  const id = request.nextUrl.pathname.split('/').at(-2) ?? '';
  if (!id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Grievance ID required');
  }

  const result = await suggestClausesForGrievance({
    grievanceId: id,
    organizationId,
    userId: userId ?? '',
  });

  return NextResponse.json(result);
});
