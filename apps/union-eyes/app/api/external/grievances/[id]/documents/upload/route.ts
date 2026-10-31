import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { externalDocumentAccessGrants, externalMatterAccessGrants } from '@/db/schema/representation-authority-schema';
import { withExplicitUserContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';
import { resolveStoredBlob } from '@/lib/services/document-blob-integrity-service';
import { deriveExternalUploadGrant, EXTERNAL_UPLOAD_LABELS } from '@/lib/services/external-upload-authority';

const documentBlobContainer = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

const externalUploadSchema = z.object({
  title: z.string().min(1).max(300),
  filename: z.string().min(1).max(500),
  fileUrl: z.string().url().optional(),
  blobPath: z.string().min(1).optional(),
  documentType: z.string().min(1).max(120),
  mimeType: z.string().min(1).max(120),
  privacyLabel: z.enum(EXTERNAL_UPLOAD_LABELS).default('case_restricted'),
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

    const created = await withExplicitUserContext(context.actor.userId, async () => {
      const [matterGrant] = await db
        .select()
        .from(externalMatterAccessGrants)
        .where(and(
          eq(externalMatterAccessGrants.id, context.matterGrantId),
          eq(externalMatterAccessGrants.authorityId, context.authorityId),
          eq(externalMatterAccessGrants.organizationId, context.organizationId),
          eq(externalMatterAccessGrants.userId, context.actor.userId),
          eq(externalMatterAccessGrants.representativeOrganizationId, representativeOrganizationId),
          eq(externalMatterAccessGrants.matterType, matterType),
          eq(externalMatterAccessGrants.matterId, context.matterId),
        ))
        .limit(1);
      const derived = deriveExternalUploadGrant({
        actorUserId: context.actor.userId,
        grant: matterGrant,
        authorityId: context.authorityId,
        matterGrantId: context.matterGrantId,
        organizationId: context.organizationId,
        representativeOrganizationId,
        matterType,
        matterId: context.matterId,
      });
      if (!derived.ok) return { forbidden: true as const };

      // The representative names a stored object; nothing shows it is theirs. An object another record already holds (a document
      // or a version of one) is some other matter's file, so it is never attached here through an upload.
      const [heldByDocument] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.organizationId, context.organizationId), eq(documents.blobPath, resolvedBlob.blobPath)))
        .limit(1);
      const [heldByVersion] = heldByDocument
        ? []
        : await db
            .select({ id: documentVersions.id })
            .from(documentVersions)
            .where(and(eq(documentVersions.organizationId, context.organizationId), eq(documentVersions.storageKey, resolvedBlob.blobPath)))
            .limit(1);
      if (heldByDocument || heldByVersion) return { conflict: true as const };

      const [insertedDocument] = await db
        .insert(documents)
        .values({
          organizationId: context.organizationId,
          orgId: context.organizationId,
          title: parsed.data.title,
          category: 'other',
          blobContainer: documentBlobContainer,
          blobPath: resolvedBlob.blobPath,
          contentType: parsed.data.mimeType,
          sizeBytes: parsed.data.fileSize,
          sha256: resolvedBlob.contentHash,
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
        .returning({
          id: documents.id,
          title: documents.title,
          name: documents.name,
        });

      await db.insert(documentVersions).values({
        organizationId: context.organizationId,
        documentId: insertedDocument.id,
        versionNo: 1,
        storageKey: resolvedBlob.blobPath,
        contentHash: resolvedBlob.contentHash,
        uploadedBy: context.actor.userId,
      });

      await db.insert(documentLinks).values({
        organizationId: context.organizationId,
        documentId: insertedDocument.id,
        linkedEntityType: 'grievance',
        linkedEntityId: context.matterId,
        linkedBy: context.actor.userId,
      });

      await db.insert(externalDocumentAccessGrants).values({
        authorityId: context.authorityId,
        matterGrantId: context.matterGrantId,
        organizationId: context.organizationId,
        representativeOrganizationId,
        userId: context.actor.userId,
        matterType,
        matterId: context.matterId,
        documentId: insertedDocument.id,
        status: 'active',
        canView: derived.grant.canView,
        canDownload: derived.grant.canDownload,
        canShare: derived.grant.canShare,
        // The grant covers the one version this upload stored.
        documentVersionNo: 1,
        grantedBy: derived.grant.grantedBy,
      });

      // The document, its version, its link, the copied matter grant and this record commit together.
      // Upload permission does not let the representative issue a download or a privilege label.
      await persistAtomicAudit(db as unknown as RLSTx, {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        action: 'document.external_upload',
        resourceType: 'documents',
        resourceId: insertedDocument.id,
        details: { matterType, matterId: context.matterId, authorityId: context.authorityId, privacyLabel: parsed.data.privacyLabel },
      });

      return { forbidden: false as const, conflict: false as const, document: insertedDocument };
    }, context.organizationId);

    if ('conflict' in created && created.conflict) {
      return NextResponse.json({ error: 'The file is already attached to another record' }, { status: 409 });
    }
    if (created.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ data: { id: created.document.id, title: created.document.title ?? created.document.name } }, { status: 201 });
  },
);
