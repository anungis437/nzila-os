import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { issueDocumentDownload } from '@/lib/documents/download-issuance';

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canRead = await hasMinRole('member');
  if (!canRead) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  if (!params?.id || !isDocumentId(params.id)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
  }

  const outcome = await issueDocumentDownload({
    organizationId,
    userId,
    documentId: params.id,
    route: '/api/documents/[id]/download',
  });

  switch (outcome.kind) {
    case 'issued':
      return standardSuccessResponse({
        id: outcome.id,
        title: outcome.title,
        mimeType: outcome.mimeType,
        downloadUrl: outcome.downloadUrl,
      });
    case 'invalid_id':
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    case 'not_found':
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Document not found');
    case 'denied':
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        outcome.reason === 'download_not_granted'
          ? 'You do not have permission to download this document'
          : 'You do not have access to this document',
      );
    case 'storage_unavailable':
      return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage is unavailable');
    case 'storage_unverified':
      return standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Document storage location could not be verified');
    case 'audit_failed':
      return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'Document download audit could not be recorded');
  }
});
