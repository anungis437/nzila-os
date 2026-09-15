import { z } from 'zod';
import { NextResponse } from 'next/server';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { externalDocumentAccessGrants } from '@/db/schema/representation-authority-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';
import { resolveStoredBlob } from '@/lib/services/document-blob-integrity-service';

const externalUploadSchema = z.object({
  title: z.string().min(1).max(300),
  filename: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  blobPath: z.string().min(1).optional(),
  documentType: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(120),
  privacyLabel: z.enum([
    'team_confidential',
    'lro_confidential',
    'privileged',
    'case_restricted',
    'highly_sensitive',
  ]).default('case_restricted'),
  fileSize: z.number().int().nonnegative().optional(),
}).refine((value) => Boolean(value.blobPath || value.fileUrl), {
  message: 'blobPath or fileUrl is required',
  path: ['blobPath'],
});

export const POST = withExternalMatterResourceAuth(
  {
    requiredPermission: 'upload_documents',
    resolve: resolveExternalGrievanceResource,
  },
  async (request, context) => {
    if (context.matterType !== 'grievance' || !context.actor.representativeOrganizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const representativeOrganizationId = context.actor.representativeOrganizationId;
    const matterType = context.matterType;

    const parsed = externalUploadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid document payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const resolvedBlob = await resolveStoredBlob({
      organizationId: context.organizationId,
      blobPath: parsed.data.blobPath,
      fileUrl: parsed.data.fileUrl,
    });

    const created = await withRLSContext({ organizationId: context.organizationId }, async (tx) => {
      const [insertedDocument] = await tx
        .insert(documents)
        .values({
          organizationId: context.organizationId,
          title: parsed.data.title,
          filename: parsed.data.filename,
          name: parsed.data.title,
          fileUrl: resolvedBlob.fileUrl,
          fileType: parsed.data.documentType,
          documentType: parsed.data.documentType,
          mimeType: parsed.data.mimeType,
          fileSize: parsed.data.fileSize,
          uploadedBy: context.actor.userId,
          privacyLabel: parsed.data.privacyLabel,
        })
        .returning();

      await tx.insert(documentVersions).values({
        organizationId: context.organizationId,
        documentId: insertedDocument.id,
        versionNo: 1,
        storageKey: resolvedBlob.blobPath,
        contentHash: resolvedBlob.contentHash,
        uploadedBy: context.actor.userId,
      });

      await tx.insert(documentLinks).values({
        organizationId: context.organizationId,
        documentId: insertedDocument.id,
        linkedEntityType: 'grievance',
        linkedEntityId: context.matterId,
        linkedBy: context.actor.userId,
      });

      await tx.insert(externalDocumentAccessGrants).values({
        authorityId: context.authorityId,
        matterGrantId: context.matterGrantId,
        organizationId: context.organizationId,
        representativeOrganizationId,
        userId: context.actor.userId,
        matterType,
        matterId: context.matterId,
        documentId: insertedDocument.id,
        status: 'active',
        canView: true,
        canDownload: true,
        canShare: false,
        grantedBy: context.actor.userId,
      });

      return insertedDocument;
    });

    return NextResponse.json({ data: { id: created.id, title: created.title ?? created.name } }, { status: 201 });
  },
);
