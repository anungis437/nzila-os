import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApi, ApiError, ErrorCode } from '@/lib/api/framework';
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding';
import { hasMinRole } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { BlobTooLargeError, readBlobBounded } from '@/lib/blob-client';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { verifyDocumentDownloadLease, DocumentDownloadLeaseError } from '@/lib/documents/download-lease';
import { DOCUMENT_DOWNLOAD_MAX_BYTES, locateDocumentDownload } from '@/lib/documents/download-issuance';
import { logger } from '@/lib/logger';
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { documentAttachmentName } from '@/lib/documents/attachment-name';

/** Internal downloads cross the application's private storage boundary only
 * after live member/case authorization. Storage I/O holds no DB transaction;
 * the exact artifact and live authority are checked again before audited release. */
export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  rlsOrgContext: false,
  entitlement: 'grievance_case_suite',
  rateLimit: RATE_LIMITS.DOCUMENT_DOWNLOAD,
  openapi: { tags: ['Documents'], summary: 'Download the exact authorized document through private storage' },
}, async ({ request, params, organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
  if (!params.id || !isDocumentId(params.id)) throw ApiError.notFound('Document');
  const documentId = params.id;
  const token = new URL(request.url).searchParams.get('lease') ?? '';
  const expected = { organizationId, userId, documentId };
  let lease;
  try { lease = verifyDocumentDownloadLease(token, expected); }
  catch (error) {
    if (error instanceof DocumentDownloadLeaseError) throw ApiError.forbidden('Document download link is invalid or expired');
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'Document download is unavailable');
  }
  const input = { ...expected, isStaff: await hasMinRole('steward'), route: '/api/documents/[id]/content' };
  const located = await withRLSContext({ organizationId }, tx =>
    locateDocumentDownload(tx, input, { versionId: lease.versionId }));
  if (located.kind === 'not_found' || located.kind === 'invalid_id') throw ApiError.notFound('Document');
  if (located.kind !== 'located' || located.versionId !== lease.versionId || located.fingerprint !== lease.fingerprint)
    throw ApiError.forbidden('Document download is no longer authorized');
  if (located.sizeBytes !== null && located.sizeBytes > DOCUMENT_DOWNLOAD_MAX_BYTES)
    return NextResponse.json({ error: 'This file is too large to download here' }, { status: 413 });

  let bytes: Buffer;
  try { bytes = await readBlobBounded(located.blobPath, DOCUMENT_DOWNLOAD_MAX_BYTES); }
  catch (error) {
    if (error instanceof BlobTooLargeError)
      return NextResponse.json({ error: 'This file is too large to download here' }, { status: 413 });
    // Never include the link, storage credential or provider's raw URL in logs.
    logger.error('Document bytes could not be read', { documentId, errorType: error instanceof Error ? error.name : 'Unknown' });
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'Document download is unavailable');
  }
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if ((located.contentHash !== null && checksum !== located.contentHash)
    || (located.sizeBytes !== null && bytes.length !== located.sizeBytes))
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'Document content could not be verified');

  // A slow storage read cannot extend the original link lifetime or retain
  // authority that was revoked while the bytes were being fetched.
  try { verifyDocumentDownloadLease(token, expected); }
  catch { throw ApiError.forbidden('Document download link is invalid or expired'); }
  const currentInput = { ...input, isStaff: await hasMinRole('steward') };
  const released = await withRLSContext({ organizationId }, async tx => {
    const current = await locateDocumentDownload(tx, currentInput, { versionId: lease.versionId, lock: true });
    if (current.kind !== 'located' || current.versionId !== lease.versionId
      || current.fingerprint !== lease.fingerprint || current.fingerprint !== located.fingerprint)
      return false;
    verifyDocumentDownloadLease(token, expected);
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'document.download_served', resourceType: 'documents', resourceId: documentId,
      details: { route: input.route, delivery: 'application_response_authorized', versionId: current.versionId,
        versionNo: current.versionNo, checksumSha256: checksum, sizeBytes: bytes.length,
        privacyLabel: current.privacyLabel, integrityBasis: current.integrityBasis },
    });
    return true;
  }).catch((error: unknown) => {
    if (error instanceof DocumentDownloadLeaseError
      || (error instanceof AuthOrgBindingError && ['MEMBERSHIP_REQUIRED', 'ROLE_REQUIRED', 'INVALID_ORGANIZATION', 'ACTOR_MISMATCH'].includes(error.code)))
      throw ApiError.forbidden('Document download is no longer authorized');
    logger.error('Document byte release could not be recorded', { documentId, errorType: error instanceof Error ? error.name : 'Unknown' });
    throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, 'Document download could not be recorded');
  });
  if (!released) throw ApiError.forbidden('Document download is no longer authorized');

  const mimeType = located.mimeType && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(located.mimeType)
    ? located.mimeType : 'application/octet-stream';
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers: {
    'Content-Type': mimeType,
    'Content-Length': String(bytes.length),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(documentAttachmentName(located.filename))}`,
    'Cache-Control': 'private, no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  } });
});
