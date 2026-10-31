import { z } from 'zod';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  standardErrorResponse,
  standardSuccessResponse,
  ErrorCode,
} from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import {
  documents,
  documentLinks,
  documentVersions,
} from '@/db/schema/documents-schema';
import { hasMinRole } from '@/lib/api-auth-guard';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import {
  isDocumentVisibleByPolicy,
  normalizeDocumentTitle,
  toGovernanceLabel,
} from '@/lib/services/document-governance-service';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { hasDocumentContextAccess } from '@/lib/services/document-member-scope';
import { resolveStoredBlob, storedBlobFailure } from '@/lib/services/document-blob-integrity-service';
import { bindIntakeInTx, checkIntakeForAcceptance, IntakeConflictError } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';
import { intakeRefusal } from '@/lib/documents/intake-acceptance';
import { generateSasUrl } from '@/lib/blob-client';
import { listPage } from '@/lib/api/list-page';

const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  filename: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  blobPath: z.string().min(1).optional(),
  // The server-issued handle for an uploaded file (POST /api/documents/intakes). Preferred; consumed exactly once.
  intakeId: z.guid().optional(),
  // A claim, not a fact: when supplied it must equal the SHA-256 the server computes from storage.
  contentHash: z.string().regex(/^[0-9a-fA-F]{64}$/, 'contentHash must be a SHA-256 hex digest').optional(),
  documentType: z.string().min(1).max(120),
  // Required unless an intakeId is given: the server then uses the type it recorded when it received the file.
  mimeType: z.string().min(1).max(120).optional(),
  privacyLabel: z.enum([
    'public_internal',
    'team_confidential',
    'lro_confidential',
    'privileged',
    'case_restricted',
    'highly_sensitive',
  ]),
  fileSize: z.number().int().nonnegative().optional(),
  linkedEntityType: z.enum(['case', 'grievance', 'member', 'policy_library', 'template_library', 'collective_agreement', 'other']).optional(),
  linkedEntityId: z.guid().optional(),
  containsPii: z.boolean().optional(),
  containsMedicalSensitive: z.boolean().optional(),
  containsLegalPrivilege: z.boolean().optional(),
  memberPii: z.boolean().optional(),
  medicalSensitive: z.boolean().optional(),
  disciplinarySensitive: z.boolean().optional(),
}).refine((value) => [value.intakeId, value.blobPath, value.fileUrl].filter(Boolean).length === (value.fileUrl && value.blobPath ? 2 : 1), {
  message: 'intakeId, blobPath or fileUrl is required (intakeId cannot be combined with a storage reference)',
  path: ['intakeId'],
}).refine((value) => Boolean(value.intakeId || value.mimeType), {
  message: 'mimeType is required without an intakeId',
  path: ['mimeType'],
});

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canRead = await hasMinRole('member');
  if (!canRead) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const searchParams = new URL(request.url).searchParams;
  const keyword = searchParams.get('keyword');
  const label = searchParams.get('label');
  const documentType = searchParams.get('documentType');
  const linkedCase = searchParams.get('linkedCase');
  const uploader = searchParams.get('uploader');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  // Bound candidate scans before per-document case-authority checks. The offset always
  // addresses candidate rows, not visible rows, so a filtered page cannot repeat rows.
  const { limit, offset } = listPage(request, 100, 50);
  if (linkedCase && !z.guid().safeParse(linkedCase).success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'linkedCase must be a valid case identifier');
  }
  if ((keyword?.length ?? 0) > 200 || (documentType?.length ?? 0) > 120 || (uploader?.length ?? 0) > 128) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Document search filter is too long');
  }
  if ((fromDate && !Number.isFinite(Date.parse(fromDate))) || (toDate && !Number.isFinite(Date.parse(toDate)))) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document date filter');
  }

  const conditions = [eq(documents.organizationId, organizationId), sql`${documents.deletedAt} IS NULL`];

  if (keyword) {
    conditions.push(
      sql`(
        ${documents.title} ILIKE ${`%${keyword}%`} OR
        ${documents.filename} ILIKE ${`%${keyword}%`} OR
        ${documents.name} ILIKE ${`%${keyword}%`} OR
        ${documents.contentText} ILIKE ${`%${keyword}%`}
      )`,
    );
  }

  if (label) {
    conditions.push(eq(documents.privacyLabel, label as never));
  }

  if (documentType) {
    conditions.push(ilike(documents.documentType, documentType));
  }

  if (uploader) {
    conditions.push(eq(documents.uploadedBy, uploader));
  }

  // A case filter is enforced in SQL rather than scanning the organization's
  // entire repository and discarding nonmatching links after the read.
  if (linkedCase) {
    conditions.push(eq(documentLinks.linkedEntityId, linkedCase));
  }

  if (fromDate) {
    conditions.push(gte(documents.createdAt, new Date(fromDate)));
  }

  if (toDate) {
    conditions.push(lte(documents.createdAt, new Date(toDate)));
  }

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      name: documents.name,
      filename: documents.filename,
      documentType: documents.documentType,
      privacyLabel: documents.privacyLabel,
      uploadedBy: documents.uploadedBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      linkedEntityType: documentLinks.linkedEntityType,
      linkedEntityId: documentLinks.linkedEntityId,
    })
    .from(documents)
    .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt), desc(documents.id))
    .limit(limit)
    .offset(offset);

  // Representative-level role: eligibility for organization-level (unlinked) documents and the uploader
  // projection only, never case content.
  const isStaff = await hasMinRole('steward');

  const visible = await Promise.all(
    rows.map(async (row) => {
      let caseAccess = {
        isPrimaryOwner: false,
        canViewCase: false,
        canViewPrivateDocuments: false,
      };

      if (row.linkedEntityType === 'grievance' && row.linkedEntityId) {
        const effective = await getEffectiveCaseAccess({
          organizationId,
          grievanceId: row.linkedEntityId,
          userId,
        });
        caseAccess = {
          isPrimaryOwner: effective.isPrimaryOwner,
          canViewCase: effective.canViewCase,
          canViewPrivateDocuments: effective.canViewPrivateDocuments,
        };
      }

      const allowed = isDocumentVisibleByPolicy(
        toGovernanceLabel({ privacyLabel: row.privacyLabel ?? undefined }),
        {
          isOrgMember: true,
          isPrimaryOwner: caseAccess.isPrimaryOwner,
          hasCaseAccess: hasDocumentContextAccess({
            isStaff,
            canViewCase: caseAccess.canViewCase,
            hasExplicitGrant: false,
            linkedEntityId: row.linkedEntityId,
            privacyLabel: row.privacyLabel,
            uploadedBy: row.uploadedBy,
            userId,
          }),
          canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
          hasExplicitDocumentGrant: false,
        },
      );

      if (!allowed) {
        return null;
      }

      // Uploader identity is staff-only; members see their documents without other users' ids.
      const { uploadedBy: uploaderId, ...withoutUploader } = row;

      return {
        ...(isStaff ? { ...withoutUploader, uploadedBy: uploaderId } : withoutUploader),
        title: normalizeDocumentTitle(row),
      };
    }),
  );

  // Keep the response's data as an array for existing clients. Metadata lets them
  // continue from a fixed candidate-row offset, even when visibility removes an entire page.
  // Do not disclose hasMore or the candidate count: either would reveal the presence
  // of documents that the case/privilege policy withheld from this member.
  return standardSuccessResponse(visible.filter(Boolean), {
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    nextOffset: offset + limit,
  });
});

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  const canUpload = await hasMinRole('member');
  if (!canUpload) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const body = await request.json();
  const parsed = uploadDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid document payload', parsed.error.flatten());
  }

  // Filing a document against a case is a case action: the kernel must allow this principal to add evidence to it.
  if ((parsed.data.linkedEntityType === 'grievance' || parsed.data.linkedEntityType === 'case') && parsed.data.linkedEntityId) {
    const access = await getEffectiveCaseAccess({ organizationId, grievanceId: parsed.data.linkedEntityId, userId });
    if (!access.canViewCase || !access.canUploadDocuments) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Case not found');
  } else if (parsed.data.linkedEntityId) {
    // A different link type must not be a way around the case check: an id that names a case of this organization is
    // filed against that case, so the same kernel decision applies. Any other id is a non-case target.
    const [namedCase] = await db
      .select({ id: grievances.id })
      .from(grievances)
      .where(and(eq(grievances.id, parsed.data.linkedEntityId), eq(grievances.organizationId, organizationId)))
      .limit(1);
    if (namedCase) {
      const access = await getEffectiveCaseAccess({ organizationId, grievanceId: namedCase.id, userId });
      if (!access.canViewCase || !access.canUploadDocuments) return standardErrorResponse(ErrorCode.NOT_FOUND, 'Case not found');
    }
  }

  let intakeId: string | null = null;
  let intakeMeta: { mimeType: string; size: number } | null = null;
  let resolvedBlob;
  try {
    if (parsed.data.intakeId) {
      const check = await checkIntakeForAcceptance(
        { organizationId, userId, intakeId: parsed.data.intakeId, operation: 'create_document' },
        blobIntakeStorage,
      );
      if (!check.ok) return intakeRefusal(check);
      if (check.replay) {
        // The same principal asking again gets the original result; nothing is written twice.
        const [existing] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, check.intake.acceptedDocumentId ?? ''), eq(documents.organizationId, organizationId)))
          .limit(1);
        return existing ? standardSuccessResponse({ ...existing, replay: true }) : standardErrorResponse(ErrorCode.CONFLICT, 'The intake was already used');
      }
      intakeId = check.intake.id;
      intakeMeta = { mimeType: check.intake.mimeType, size: Number(check.intake.sizeBytes) };
      resolvedBlob = {
        blobPath: check.intake.storageKey,
        contentHash: check.intake.contentHash,
        fileUrl: await generateSasUrl(process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes', check.intake.storageKey),
      };
    } else {
      resolvedBlob = await resolveStoredBlob({
        organizationId,
        blobPath: parsed.data.blobPath,
        fileUrl: parsed.data.fileUrl,
        expectedContentHash: parsed.data.contentHash,
      });
    }
  } catch (error) {
    const failure = storedBlobFailure(error);
    return standardErrorResponse(
      failure.status === 'conflict' ? ErrorCode.CONFLICT : ErrorCode.VALIDATION_ERROR,
      failure.message,
    );
  }

  let created;
  try {
  created = await withRLSContext({ organizationId }, async (tx) => {
    // A stored file belongs to one document version; one another document already holds cannot be claimed again.
    const inUse = (
      await tx
        .select({ id: documentVersions.id })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.storageKey, resolvedBlob.blobPath)))
        .limit(1)
    )[0];
    if (inUse) return null;

    const [insertedDocument] = await tx
      .insert(documents)
      .values({
        organizationId,
        title: parsed.data.title,
        filename: parsed.data.filename,
        name: parsed.data.title,
        fileUrl: resolvedBlob.fileUrl,
        fileType: parsed.data.documentType,
        documentType: parsed.data.documentType,
        // From an intake, the server's own record of the file wins over anything the client says about it.
        mimeType: intakeMeta?.mimeType ?? parsed.data.mimeType,
        fileSize: intakeMeta?.size ?? parsed.data.fileSize,
        uploadedBy: userId,
        privacyLabel: parsed.data.privacyLabel,
        containsPii: parsed.data.containsPii ?? false,
        containsMedicalSensitive: parsed.data.containsMedicalSensitive ?? false,
        containsLegalPrivilege: parsed.data.containsLegalPrivilege ?? false,
        memberPii: parsed.data.memberPii ?? false,
        medicalSensitive: parsed.data.medicalSensitive ?? false,
        disciplinarySensitive: parsed.data.disciplinarySensitive ?? false,
      })
      .returning();

    const [firstVersion] = await tx
      .insert(documentVersions)
      .values({
        organizationId,
        documentId: insertedDocument.id,
        versionNo: 1,
        storageKey: resolvedBlob.blobPath,
        contentHash: resolvedBlob.contentHash,
        uploadedBy: userId,
      })
      .returning({ id: documentVersions.id });

    // Taking the intake and creating the document are one transaction: a lost race or a refused audit undoes both.
    if (intakeId) await bindIntakeInTx(tx, { organizationId, userId, intakeId, documentId: insertedDocument.id, versionId: firstVersion.id });

    if (parsed.data.linkedEntityType && parsed.data.linkedEntityId) {
      await tx.insert(documentLinks).values({
        organizationId,
        documentId: insertedDocument.id,
        linkedEntityType: parsed.data.linkedEntityType,
        linkedEntityId: parsed.data.linkedEntityId,
        linkedBy: userId,
      });
    }

    // The document, its version, its link and the audit record commit together.
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'document.upload',
      resourceType: 'documents',
      resourceId: insertedDocument.id,
      details: {
        privacyLabel: insertedDocument.privacyLabel,
        documentType: insertedDocument.documentType,
        ...(parsed.data.linkedEntityType && parsed.data.linkedEntityId
          ? { linkedEntityType: parsed.data.linkedEntityType, linkedEntityId: parsed.data.linkedEntityId }
          : {}),
      },
    });

    return insertedDocument;
  });
  } catch (error) {
    if (error instanceof IntakeConflictError) return standardErrorResponse(ErrorCode.CONFLICT, 'The intake is no longer open');
    throw error;
  }

  if (!created) {
    return standardErrorResponse(ErrorCode.CONFLICT, 'That stored file is already attached to a document version');
  }

  return standardSuccessResponse(created);
});
