import { withApi, ApiError } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { issueDocumentDownload } from '@/lib/documents/download-issuance';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    openapi: { tags: ['Documents'], summary: 'Issue a time-limited, audited download link for a document' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }

    if (!params.id || !isDocumentId(params.id)) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document ID');
    }

    const isStaff = await hasMinRole('steward');
    const documentId = params.id;
    const outcome = await withRLSContext({ organizationId }, (tx) =>
      issueDocumentDownload(tx, {
        organizationId,
        userId,
        documentId,
        isStaff,
        route: '/api/documents/[id]/download',
      }),
    );

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
  },
);
