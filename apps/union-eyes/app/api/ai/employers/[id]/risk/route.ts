/**
 * GET /api/ai/employers/[id]/risk
 * AI-powered employer risk assessment.
 *
 * Feature-gated: AI_EMPLOYER_RISK (placeholder — not yet implemented)
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';

type Params = { params: Promise<{ id: string }> };

export const GET = withRoleAuth('steward', async (_request: NextRequest, _context: BaseAuthContext, { params }: Params) => {
  const { id } = await params;
  return standardErrorResponse(
    ErrorCode.NOT_IMPLEMENTED,
    `Employer risk assessment for ${id} is not yet available`,
  );
});
