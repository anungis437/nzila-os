/**
 * POST /api/documents/intakes/[id]/cancel
 *
 * Cancels the principal's own open intake. An accepted intake cannot be cancelled: its object belongs to a document.
 * The object is deleted by the exact-key cleanup from the key the row records, never from anything in this request.
 */
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { cancelIntake, finalizeIntakeObjects } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';

export const POST = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  if (!(await hasMinRole('member'))) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  if (!params?.id || !isDocumentId(params.id)) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid intake ID');

  const result = await cancelIntake({ organizationId: context.organizationId, userId: context.userId, intakeId: params.id });
  if (!result.ok) {
    if (result.kind === 'not_found') return standardErrorResponse(ErrorCode.NOT_FOUND, 'Intake not found');
    return standardErrorResponse(ErrorCode.CONFLICT, result.kind === 'accepted' ? 'An accepted intake cannot be cancelled' : 'The intake has already expired');
  }

  // Prompt cleanup is a courtesy; a failing storage service leaves the row for the reaper, which retries.
  await finalizeIntakeObjects(blobIntakeStorage, { limit: 5 }).catch((error) =>
    logger.warn('Intake object cleanup deferred', { error: error instanceof Error ? error.message : 'unknown' }),
  );
  return standardSuccessResponse(result.intake);
});
