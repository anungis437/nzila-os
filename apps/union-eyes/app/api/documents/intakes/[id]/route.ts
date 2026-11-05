/** GET /api/documents/intakes/[id]  the principal's own intake: its state and the facts the server recorded. */
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { getOwnIntake } from '@/lib/documents/intake-lifecycle';

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  if (!(await hasMinRole('member'))) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  if (!params?.id || !isDocumentId(params.id)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid intake ID');
  const intake = await getOwnIntake({ organizationId: context.organizationId, userId: context.userId, intakeId: params.id });
  // Another principal's intake is indistinguishable from one that does not exist.
  if (!intake) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Intake not found');
  return standardSuccessResponse(intake);
});
