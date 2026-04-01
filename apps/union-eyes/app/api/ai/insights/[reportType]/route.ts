/**
 * GET /api/ai/insights/[reportType]
 * AI-generated insights for a specific report type.
 *
 * Feature-gated: AI_INSIGHTS (placeholder — not yet implemented)
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';

type Params = { params: Promise<{ reportType: string }> };

export const GET = withRoleAuth('steward', async (_request: NextRequest, _context: BaseAuthContext, { params }: Params) => {
  const { reportType } = await params;
  return standardErrorResponse(
    ErrorCode.NOT_IMPLEMENTED,
    `AI insights for report type "${reportType}" are not yet available`,
  );
});
