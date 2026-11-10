/**
 * POST /api/external/grievances/[id]/documents/intakes?organizationId=…   multipart: file
 *
 * An external representative's upload of a file for one grievance. The server stores the file under a key it issues, computes the checksum and
 * records an intake bound to the representative, the organization and this grievance (platform 0022 and 0080). The answer is the intake id and
 * the facts recorded, never the storage key. The intake is consumed by POST /api/external/grievances/[id]/documents/upload with that intakeId,
 * for this grievance only, before it expires (DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE).
 */
import { NextResponse } from 'next/server';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { isMalwareScanError } from '@/lib/security/clamav';
import { OCR_MAX_BYTES } from '@/lib/documents/ocr-intake';
import { verifyDeclaredContentType } from '@/lib/documents/content-signature';
import { openIntake } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';

export const dynamic = 'force-dynamic';
const MULTIPART_ENVELOPE_BYTES = 64 * 1024;

export const POST = withExternalMatterResourceAuth(
  {
    requiredPermission: 'upload_documents',
    resolve: resolveExternalGrievanceResource,
    // Opening the intake writes its own record (document.intake.open), carrying the matter; it is not a read.
    readRecord: 'handler',
    // The file goes to storage: only the authorization decision holds a transaction.
    transaction: 'authorization',
  },
  async (request, context) => {
    if (context.matterType !== 'grievance' || !context.actor.representativeOrganizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rate = await checkRateLimit(`doc-upload:${context.actor.userId}`, RATE_LIMITS.DOCUMENT_UPLOAD);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded', resetIn: rate.resetIn }, { status: 429, headers: createRateLimitHeaders(rate) });
    }

    const announced = Number(request.headers.get('content-length') ?? '');
    if (Number.isFinite(announced) && announced > OCR_MAX_BYTES + MULTIPART_ENVELOPE_BYTES) {
      return NextResponse.json({ error: 'File size is not allowed' }, { status: 413 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    if (file.size <= 0 || file.size > OCR_MAX_BYTES) return NextResponse.json({ error: 'File size is not allowed' }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length <= 0 || bytes.length > OCR_MAX_BYTES) return NextResponse.json({ error: 'File size is not allowed' }, { status: 400 });
    const typed = verifyDeclaredContentType(bytes, file.type);
    if (!typed.ok) {
      return NextResponse.json(
        { error: typed.reason === 'type_not_allowed' ? 'File type is not allowed' : 'File content does not match its declared type' },
        { status: 400 },
      );
    }

    const opened = await openIntake(
      {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        operation: 'create_document',
        targetDocumentId: null,
        filename: file.name,
        mimeType: typed.mimeType,
        bytes,
        matter: { type: context.matterType, id: context.matterId },
      },
      blobIntakeStorage,
    );
    if (!opened.ok) {
      if (opened.kind === 'upload_failed' && isMalwareScanError(opened.error)) {
        return opened.error.result.status === 'infected'
          ? NextResponse.json({ error: 'File blocked by malware scan' }, { status: 400 })
          : NextResponse.json({ error: 'Malware scanner unavailable; upload blocked by policy' }, { status: 503 });
      }
      return opened.kind === 'invalid'
        ? NextResponse.json({ error: 'Invalid intake request' }, { status: 400 })
        : NextResponse.json({ error: 'The file could not be stored' }, { status: 502 });
    }
    return NextResponse.json({ data: opened.intake }, { status: 201 });
  },
);
