/**
 * POST /api/ai/grievances/[id]/triage
 * AI-powered triage for a specific grievance by ID.
 *
 * Feature-gated: AI_GRIEVANCE_TRIAGE (placeholder — not yet implemented)
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';

export const POST = withRoleAuth('steward', async (request: NextRequest, _context: BaseAuthContext) => {
  const id = request.nextUrl.pathname.split('/').at(-2) ?? 'unknown';
  return standardErrorResponse(
    ErrorCode.NOT_IMPLEMENTED,
    `Grievance triage for ${id} is not yet available`,
  );
});
