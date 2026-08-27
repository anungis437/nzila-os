/**
 * Case evidence route — list, upload, and delete attachments bound to a case.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { putBlob, deleteBlob } from '@/lib/blob-client';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';
import { isMalwareScanError } from '@/lib/security/clamav';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';

interface AttachmentMetadata {
  url: string;
  pathname?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  malwareScan?: {
    status: 'clean' | 'infected' | 'unavailable';
    scannedAt: string;
    engine: 'clamav';
    signature?: string;
    reason?: string;
  };
  metadata?: Record<string, unknown>;
}

interface CaseRecord {
  claimId: string;
  claimNumber: string | null;
  attachments?: any;
  metadata?: any;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function normalizeAttachments(value: any): AttachmentMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AttachmentMetadata => {
    return typeof item === 'object' && item !== null && 'url' in item && 'fileName' in item;
  });
}

function sanitizeFilename(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function resolveCaseRecord(caseId: string, organizationId: string | null, userId: string | null): Promise<CaseRecord> {
  const orgFilter = organizationId
    ? sql`AND c.organization_id = ${organizationId}::uuid`
    : userId
      ? sql`AND c.member_id = ${userId}`
      : sql`AND FALSE`;

  const rows = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT c.claim_id AS "claimId", c.claim_number AS "claimNumber", c.attachments, c.metadata
    FROM claims c
    WHERE (c.claim_number = ${caseId} OR c.claim_id::text = ${caseId})
      ${orgFilter}
    LIMIT 1
  `));

  const row = rows[0] as any as CaseRecord | undefined;
  if (!row) {
    throw ApiError.notFound('Case', caseId);
  }

  return row;
}

async function persistAttachments(claimId: string, attachments: AttachmentMetadata[]): Promise<void> {
  const serialized = JSON.stringify(attachments);
  await withRLSContext(async (tx) => tx.execute(sql`
    UPDATE claims
    SET attachments = ${serialized}::jsonb,
        updated_at = NOW()
    WHERE claim_id = ${claimId}::uuid
  `));
}

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'List case evidence',
      description: 'Returns the attachments array from the claim.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const claim = await resolveCaseRecord(params.caseId, organizationId, userId);
    const attachments = normalizeAttachments(claim.attachments);
    return attachments;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'Upload case evidence',
      description: 'Uploads a file and appends attachment metadata to the case.',
    },
  },
  async ({ params, organizationId, userId, request }) => {
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const fileForm = await request.formData();
    const file = fileForm.get('file');

    if (!(file instanceof File)) {
      throw ApiError.badRequest('A file is required');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw ApiError.badRequest('File size exceeds 10MB limit');
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw ApiError.badRequest(`File type ${file.type || 'unknown'} is not allowed`);
    }

    const claim = await resolveCaseRecord(params.caseId, organizationId, userId);
    const attachments = normalizeAttachments(claim.attachments);

    let blob;
    try {
      blob = await putBlob(
        `cases/${claim.claimId}/${Date.now()}-${sanitizeFilename(file.name)}`,
        file,
        { addRandomSuffix: true },
      );
    } catch (error) {
      if (isMalwareScanError(error)) {
        if (error.result.status === 'infected') {
          throw ApiError.badRequest('File blocked by malware scan', {
            scanStatus: error.result.status,
            signature: error.result.signature,
          });
        }

        throw ApiError.externalService('ClamAV', 'Scanner unavailable. Upload blocked by policy');
      }
      throw error;
    }

    const attachment: AttachmentMetadata = {
      url: blob.url,
      pathname: blob.pathname,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      malwareScan: blob.malwareScan,
    };

    const nextAttachments = [...attachments, attachment];
    await persistAttachments(claim.claimId, nextAttachments);

    await auditCaseMutation({
      event: CaseAuditEvent.CASE_ATTACHMENT_UPLOADED,
      userId,
      organizationId: organizationId ?? '',
      caseId: claim.claimId,
      action: 'update',
      newState: { attachments: nextAttachments },
      details: {
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        attachmentUrl: attachment.url,
        scanStatus: attachment.malwareScan?.status,
        scanSignature: attachment.malwareScan?.signature,
      },
    });

    return { attachment };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'Delete case evidence',
      description: 'Deletes an attachment and removes it from the case metadata.',
    },
  },
  async ({ params, organizationId, userId, request }) => {
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const fileUrl = request.nextUrl.searchParams.get('fileUrl');
    if (!fileUrl) {
      throw ApiError.badRequest('fileUrl query parameter is required');
    }

    const claim = await resolveCaseRecord(params.caseId, organizationId, userId);
    const attachments = normalizeAttachments(claim.attachments);
    const attachment = attachments.find((item) => item.url === fileUrl);

    if (!attachment) {
      throw ApiError.notFound('Attachment');
    }

    const mutabilityBlockReason = getDocumentMutabilityBlockReason({ metadata: claim.metadata })
      ?? getDocumentMutabilityBlockReason({ metadata: attachment.metadata });
    if (mutabilityBlockReason) {
      throw ApiError.badRequest(mutabilityBlockReason, {
        caseId: claim.claimId,
        attachmentUrl: attachment.url,
      });
    }

    await deleteBlob(attachment.pathname || attachment.url);

    const nextAttachments = attachments.filter((item) => item.url !== fileUrl);
    await persistAttachments(claim.claimId, nextAttachments);

    await auditCaseMutation({
      event: CaseAuditEvent.CASE_ATTACHMENT_DELETED,
      userId,
      organizationId: organizationId ?? '',
      caseId: claim.claimId,
      action: 'update',
      previousState: { attachment },
      newState: { attachments: nextAttachments },
      details: {
        fileName: attachment.fileName,
        attachmentUrl: attachment.url,
      },
    });

    return { deleted: true };
  },
);
