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
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import {
  isDocumentVisibleByPolicy,
  normalizeDocumentTitle,
  toGovernanceLabel,
} from '@/lib/services/document-governance-service';
import { auditCaseMutation, CaseAuditEvent } from '@/lib/audited-case-mutations';

const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  filename: z.string().min(1).max(500),
  fileUrl: z.string().url(),
  documentType: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(120),
  privacyLabel: z.enum([
    'public_internal',
    'team_confidential',
    'lro_confidential',
    'privileged',
    'case_restricted',
    'highly_sensitive',
  ]),
  fileSize: z.number().int().nonnegative().optional(),
  contentHash: z.string().min(8),
  linkedEntityType: z.enum(['case', 'grievance', 'member', 'policy_library', 'template_library', 'collective_agreement', 'other']).optional(),
  linkedEntityId: z.string().uuid().optional(),
  containsPii: z.boolean().optional(),
  containsMedicalSensitive: z.boolean().optional(),
  containsLegalPrivilege: z.boolean().optional(),
  memberPii: z.boolean().optional(),
  medicalSensitive: z.boolean().optional(),
  disciplinarySensitive: z.boolean().optional(),
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
    .orderBy(desc(documents.updatedAt));

  const isStewardPlus = await hasMinRole('steward');

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
          isStewardPlus,
          isPrimaryOwner: caseAccess.isPrimaryOwner,
          hasCaseAccess: isStewardPlus || caseAccess.canViewCase || !row.linkedEntityId,
          canViewPrivateDocuments: caseAccess.canViewPrivateDocuments,
          hasExplicitDocumentGrant: false,
        },
      );

      if (!allowed) {
        return null;
      }

      if (linkedCase && row.linkedEntityId !== linkedCase) {
        return null;
      }

      return {
        ...row,
        title: normalizeDocumentTitle(row),
      };
    }),
  );

  return standardSuccessResponse(visible.filter(Boolean));
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

  const created = await withRLSContext({ organizationId }, async (tx) => {
    const [insertedDocument] = await tx
      .insert(documents)
      .values({
        organizationId,
        title: parsed.data.title,
        filename: parsed.data.filename,
        name: parsed.data.title,
        fileUrl: parsed.data.fileUrl,
        fileType: parsed.data.documentType,
        documentType: parsed.data.documentType,
        mimeType: parsed.data.mimeType,
        fileSize: parsed.data.fileSize,
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

    await tx.insert(documentVersions).values({
      organizationId,
      documentId: insertedDocument.id,
      versionNo: 1,
      storageKey: parsed.data.fileUrl,
      contentHash: parsed.data.contentHash,
      uploadedBy: userId,
    });

    if (parsed.data.linkedEntityType && parsed.data.linkedEntityId) {
      await tx.insert(documentLinks).values({
        organizationId,
        documentId: insertedDocument.id,
        linkedEntityType: parsed.data.linkedEntityType,
        linkedEntityId: parsed.data.linkedEntityId,
        linkedBy: userId,
      });
    }

    return insertedDocument;
  });

  if (parsed.data.linkedEntityType && parsed.data.linkedEntityId) {

    if (parsed.data.linkedEntityType === 'grievance') {
      await auditCaseMutation({
        event: CaseAuditEvent.CASE_ATTACHMENT_UPLOADED,
        userId,
        organizationId,
        caseId: parsed.data.linkedEntityId,
        action: 'create',
        newState: { documentId: created.id },
        details: {
          privacyLabel: created.privacyLabel,
          documentType: created.documentType,
        },
      });
    }
  }

  return standardSuccessResponse(created);
});
