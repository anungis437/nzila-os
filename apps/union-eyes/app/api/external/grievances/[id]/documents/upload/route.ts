import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { externalDocumentAccessGrants, externalMatterAccessGrants } from '@/db/schema/representation-authority-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';
import { generateSasUrl } from '@/lib/blob-client';
import { bindIntakeInTx, checkIntakeForAcceptance, IntakeConflictError } from '@/lib/documents/intake-lifecycle';
import { blobIntakeStorage } from '@/lib/documents/intake-storage';
import { deriveExternalUploadGrant, EXTERNAL_UPLOAD_LABELS } from '@/lib/services/external-upload-authority';

const documentBlobContainer = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

// The file is named only by the intake the representative opened for this grievance (POST ../intakes). A storage path or URL is not accepted:
// nothing would show the object was uploaded by this representative for this matter. The file's name, type, size and checksum are the ones the
// server recorded when it received it, not the caller's.
const externalUploadSchema = z.object({
  intakeId: z.guid(),
  title: z.string().min(1).max(300),
  documentType: z.string().min(1).max(120),
  privacyLabel: z.enum(EXTERNAL_UPLOAD_LABELS).default('case_restricted'),
}).strict();

export const POST = withExternalMatterResourceAuth(
  {
    requiredPermission: 'upload_documents',
    resolve: resolveExternalGrievanceResource,
    // The upload writes its own record (document.external_upload); it is not a read.
    readRecord: 'handler',
    // The stored object is checked against storage before anything is written: only the authorization decision holds a transaction,
    // and the write below opens its own.
    transaction: 'authorization',
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

    // The intake must be this representative's, in this organization, opened for this grievance, still open, and its object still exactly the
    // one the server recorded. Anything else is refused before a transaction opens.
    const check = await checkIntakeForAcceptance(
      {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        intakeId: parsed.data.intakeId,
        operation: 'create_document',
        matter: { type: matterType, id: context.matterId },
      },
      blobIntakeStorage,
    );
    if (!check.ok) {
      return check.kind === 'not_found'
        ? NextResponse.json({ error: 'Intake not found' }, { status: 404 })
        : NextResponse.json({ error: 'The intake cannot be used for this upload', reason: check.kind }, { status: 409 });
    }
    if (check.replay) return NextResponse.json({ error: 'The intake was already used' }, { status: 409 });
    const intake = check.intake;
    const fileUrl = await generateSasUrl(documentBlobContainer, intake.storageKey);

    const created = await withRLSContext({ organizationId: context.organizationId }, async (tx) => {
      const [matterGrant] = await tx
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

      const [insertedDocument] = await tx
        .insert(documents)
        .values({
          organizationId: context.organizationId,
          orgId: context.organizationId,
          title: parsed.data.title,
          category: 'other',
          blobContainer: documentBlobContainer,
          blobPath: intake.storageKey,
          contentType: intake.mimeType,
          sizeBytes: Number(intake.sizeBytes),
          sha256: intake.contentHash,
          filename: intake.originalFilename,
          name: parsed.data.title,
          fileUrl,
          fileType: parsed.data.documentType,
          documentType: parsed.data.documentType,
          mimeType: intake.mimeType,
          fileSize: Number(intake.sizeBytes),
          uploadedBy: context.actor.userId,
          privacyLabel: parsed.data.privacyLabel,
        })
        .returning({
          id: documents.id,
          title: documents.title,
          name: documents.name,
        });

      const [version] = await tx.insert(documentVersions).values({
        organizationId: context.organizationId,
        documentId: insertedDocument.id,
        versionNo: 1,
        storageKey: intake.storageKey,
        contentHash: intake.contentHash,
        uploadedBy: context.actor.userId,
      }).returning({ id: documentVersions.id });

      // Taking the intake and creating the document are one transaction: a lost race (another acceptance, a cancellation, expiry) undoes both.
      await bindIntakeInTx(tx, {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        intakeId: intake.id,
        documentId: insertedDocument.id,
        versionId: version.id,
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
        canView: derived.grant.canView,
        canDownload: derived.grant.canDownload,
        canShare: derived.grant.canShare,
        // The grant covers the one version this upload stored.
        documentVersionNo: 1,
        grantedBy: derived.grant.grantedBy,
      });

      // The document, its version, its link, the copied matter grant and this record commit together.
      // Upload permission does not let the representative issue a download or a privilege label.
      await persistAtomicAudit(tx, {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        action: 'document.external_upload',
        resourceType: 'documents',
        resourceId: insertedDocument.id,
        details: { matterType, matterId: context.matterId, authorityId: context.authorityId, privacyLabel: parsed.data.privacyLabel, intakeId: intake.id },
      });

      return { forbidden: false as const, document: insertedDocument };
    }).catch((error: unknown) => {
      if (error instanceof IntakeConflictError) return { intakeConflict: true as const };
      throw error;
    });

    if ('intakeConflict' in created) {
      return NextResponse.json({ error: 'The intake is no longer open' }, { status: 409 });
    }
    if (created.forbidden) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ data: { id: created.document.id, title: created.document.title ?? created.document.name } }, { status: 201 });
  },
);
