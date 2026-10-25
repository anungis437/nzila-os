import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { hasMinRole } from '@/lib/api-auth-guard';
import { issueDocumentDownload, type DownloadOutcome } from '@/lib/documents/download-issuance';

/**
 * POST /api/documents/repository/downloads
 *
 * A batch of independent downloads, not a transaction. Every document is authorized on its own, every issued link has
 * its own canonical access record, and the response reports each document's outcome. A link already issued for an
 * earlier document is not withdrawn when a later one fails, so the response says so (atomic: false) and the caller
 * must read items, not the HTTP status, to know what it holds.
 */
const MAX_BULK_DOWNLOADS = 25;

const bulkSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(MAX_BULK_DOWNLOADS),
});

type ItemResult = {
  documentId: string;
  outcome:
    | 'issued'
    | 'not_found'
    | 'denied'
    | 'download_not_granted'
    | 'storage_unavailable'
    | 'storage_unverified'
    | 'audit_failed';
  title?: string | null;
  mimeType?: string | null;
  downloadUrl?: string;
};

function describeOutcome(documentId: string, outcome: DownloadOutcome): ItemResult {
  switch (outcome.kind) {
    case 'issued':
      return {
        documentId,
        outcome: 'issued',
        title: outcome.title,
        mimeType: outcome.mimeType,
        downloadUrl: outcome.downloadUrl,
      };
    case 'denied':
      return { documentId, outcome: outcome.reason === 'download_not_granted' ? 'download_not_granted' : 'denied' };
    case 'invalid_id':
      return { documentId, outcome: 'not_found' };
    default:
      return { documentId, outcome: outcome.kind };
  }
}

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!(await hasMinRole('member'))) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid request body');
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid bulk download request', parsed.error.flatten());
  }

  const documentIds = [...new Set(parsed.data.documentIds)];
  const isStaff = await hasMinRole('steward');

  // One at a time: each issued link takes its own chained audit record, which serializes per organization.
  const items: ItemResult[] = [];
  for (const documentId of documentIds) {
    let outcome: DownloadOutcome;
    try {
      outcome = await issueDocumentDownload({
        organizationId,
        userId,
        documentId,
        isStaff,
        route: '/api/documents/repository/downloads',
      });
    } catch {
      outcome = { kind: 'storage_unavailable' };
    }
    items.push(describeOutcome(documentId, outcome));
  }

  const issued = items.filter((item) => item.outcome === 'issued').length;
  return standardSuccessResponse({
    atomic: false,
    status: issued === items.length ? 'complete' : issued === 0 ? 'none' : 'partial',
    requested: items.length,
    issued,
    failed: items.length - issued,
    items,
  });
});
