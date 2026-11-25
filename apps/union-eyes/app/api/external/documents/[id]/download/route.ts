import { DOCUMENT_CASE_LINK_TYPES } from '@/lib/documents/case-link';
import { documentAttachmentName } from '@/lib/documents/attachment-name';
import { and, inArray, eq, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { BlobTooLargeError, readBlobBounded } from '@/lib/blob-client';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import {
  badExternalResourceRequest,
  externalForbidden,
  resolveExternalDocumentResource,
} from '@/lib/external-resource-route-utils';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isDocumentId } from '@/lib/documents/canonical-journey';
import { logger } from '@/lib/logger';
import { authorizeExternalDocumentAccess } from '@/lib/services/external-resource-authorization-service';

/**
 * The file is served by this route, not handed over as a storage link. A link is a bearer URL: whoever holds it reads the file until
 * it expires, revoking the grant cannot recall it, and the audit row could only say a link was issued. Here the grant, its expiry and
 * its revocation are checked on every read, the bytes are only released after the access record is written, and that record names the
 * bytes actually delivered. A streamed read is bounded; a larger file is refused.
 *
 * The file is read from storage, which can be slow and is up to 50 MB: no database connection is held while it is. The grant, the
 * document and the version are read in one short organization transaction, the file is read, and the access record is written in a
 * second one that commits before any byte is released.
 */
export const EXTERNAL_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Versions predating explicit byte-count metadata remain pinned by their
 * stored checksum. An explicitly recorded size is never ignored if malformed. */
function versionSize(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || !('sizeBytes' in metadata)) return null;
  const value = metadata.sizeBytes;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > EXTERNAL_DOWNLOAD_MAX_BYTES)
    throw new Error('EXTERNAL_VERSION_SIZE_INVALID');
  return value;
}

export const GET = withExternalMatterResourceAuth(
  {
    requiredPermission: 'download_documents',
    protectedRead: 'download',
    resolve: resolveExternalDocumentResource,
    // The download writes its own, more specific record naming the bytes delivered.
    readRecord: 'handler',
    // Only the authorization decision holds a transaction; the handler opens its own around the database work, not the storage read.
    transaction: 'authorization',
  },
  async (_request, context, params?: { id?: string }) => {
    if (!params?.id || !context.organizationId || !context.matterId) {
      return badExternalResourceRequest();
    }
    if (context.matterType !== 'grievance') {
      return NextResponse.json({ error: 'Unsupported matter type' }, { status: 400 });
    }
    // A malformed identifier names no document: it is answered here, not as a database error.
    if (!isDocumentId(params.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const documentId = params.id;
    const { organizationId, matterId, matterType } = context;

    const located = await withRLSContext({ organizationId }, async (tx) => {
      const decision = await authorizeExternalDocumentAccess(tx, {
        actor: context.actor,
        organizationId,
        matterType,
        matterId,
        documentId,
        requiredPermission: 'download',
      }, { recordAllowed: false });
      if (!decision.allowed || !decision.authorityId || !decision.matterGrantId || !decision.documentGrantId
        || decision.authorityId !== context.authorityId || decision.matterGrantId !== context.matterGrantId) {
        return { kind: 'forbidden' as const };
      }

      const [row] = await tx
        .select({
          id: documents.id,
          title: documents.title,
          name: documents.name,
          filename: documents.filename,
          mimeType: documents.mimeType,
          privacyLabel: documents.privacyLabel,
          containsLegalPrivilege: documents.containsLegalPrivilege,
          containsMedicalSensitive: documents.containsMedicalSensitive,
          medicalSensitive: documents.medicalSensitive,
        })
        .from(documents)
        .innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.organizationId, organizationId),
            eq(documents.status, 'active'),
            isNull(documents.deletedAt),
            inArray(documentLinks.linkedEntityType, [...DOCUMENT_CASE_LINK_TYPES]),
            eq(documentLinks.linkedEntityId, matterId),
          ),
        )
        .limit(1);

      if (!row) {
        return { kind: 'not_found' as const };
      }
      if (['privileged', 'highly_sensitive'].includes(row.privacyLabel) || row.containsLegalPrivilege
        || row.containsMedicalSensitive || row.medicalSensitive) return { kind: 'forbidden' as const };

      // Every grant must name the reviewed version. A legacy null pin is ambiguous and therefore authorizes no download; it must be
      // reissued after a person reviews the intended artifact. It must never silently widen to the current/latest version.
      const pinned = decision.documentVersionNo ?? null;
      if (pinned === null) return { kind: 'forbidden' as const };
      const [pinnedVersion] = await tx
        .select({ id: documentVersions.id, versionNo: documentVersions.versionNo, storageKey: documentVersions.storageKey,
          contentHash: documentVersions.contentHash, metadata: documentVersions.metadata })
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.organizationId, organizationId),
            eq(documentVersions.documentId, row.id),
            eq(documentVersions.versionNo, pinned),
          ),
        )
        .limit(1);

      return { kind: 'located' as const, row, pinnedVersion, decision };
    });

    if (located.kind === 'forbidden') {
      return externalForbidden();
    }
    if (located.kind === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { row, pinnedVersion, decision: locatedDecision } = located;

    if (!pinnedVersion?.storageKey) {
      return NextResponse.json({ error: 'Download is not available' }, { status: 404 });
    }
    if (!/^[a-f0-9]{64}$/.test(pinnedVersion.contentHash)) return externalForbidden();

    let bytes: Buffer;
    try {
      bytes = await readBlobBounded(pinnedVersion.storageKey, EXTERNAL_DOWNLOAD_MAX_BYTES);
    } catch (error) {
      if (error instanceof BlobTooLargeError) {
        return NextResponse.json({ error: 'This file is too large to download here' }, { status: 413 });
      }
      logger.error('External document could not be read from storage', { documentId: row.id, error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Download is not available' }, { status: 503 });
    }

    const checksum = createHash('sha256').update(bytes).digest('hex');
    let expectedSize: number | null;
    try { expectedSize = versionSize(pinnedVersion.metadata); }
    catch { return externalForbidden(); }
    if (checksum !== pinnedVersion.contentHash || (expectedSize !== null && bytes.length !== expectedSize))
      return NextResponse.json({ error: 'Download is unavailable' }, { status: 503 });

    // Re-read and lock the live grant and exact artifact after storage. No
    // connection is held across the blob fetch; the final locks last through
    // the canonical audit commit, before any response bytes are released.
    try {
      const released = await withRLSContext({ organizationId }, async (tx) => {
        const currentDecision = await authorizeExternalDocumentAccess(tx, {
          actor: context.actor, organizationId, matterType, matterId, documentId, requiredPermission: 'download',
        }, { lock: true, recordAllowed: false });
        if (!currentDecision.allowed || currentDecision.authorityId !== locatedDecision.authorityId
          || currentDecision.matterGrantId !== locatedDecision.matterGrantId || currentDecision.documentGrantId !== locatedDecision.documentGrantId
          || currentDecision.documentVersionNo !== pinnedVersion.versionNo) return false;
        const [currentDocument] = await tx.select({ id: documents.id, privacyLabel: documents.privacyLabel,
          containsLegalPrivilege: documents.containsLegalPrivilege, containsMedicalSensitive: documents.containsMedicalSensitive,
          medicalSensitive: documents.medicalSensitive })
          .from(documents).innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
          .where(and(eq(documents.id, documentId), eq(documents.organizationId, organizationId), eq(documents.status, 'active'),
            isNull(documents.deletedAt), eq(documentLinks.organizationId, organizationId), inArray(documentLinks.linkedEntityType, [...DOCUMENT_CASE_LINK_TYPES]),
            eq(documentLinks.linkedEntityId, matterId))).limit(1).for('share', { of: documents });
        if (!currentDocument || currentDocument.privacyLabel !== row.privacyLabel || currentDocument.containsLegalPrivilege
          || currentDocument.containsMedicalSensitive || currentDocument.medicalSensitive) return false;
        const [currentVersion] = await tx.select({ id: documentVersions.id, versionNo: documentVersions.versionNo,
          storageKey: documentVersions.storageKey, contentHash: documentVersions.contentHash, metadata: documentVersions.metadata })
          .from(documentVersions).where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.documentId, documentId),
            eq(documentVersions.id, pinnedVersion.id), eq(documentVersions.versionNo, pinnedVersion.versionNo))).limit(1);
        if (!currentVersion || currentVersion.storageKey !== pinnedVersion.storageKey || currentVersion.contentHash !== checksum
          || versionSize(currentVersion.metadata) !== expectedSize) return false;
        await persistAtomicAudit(tx, {
          organizationId,
          userId: context.actor.userId,
          action: 'document.external_download',
          resourceType: 'documents',
          resourceId: row.id,
          details: {
            actorKind: 'external_representative',
            representativeOrganizationId: context.actor.representativeOrganizationId ?? null,
            authorityId: context.authorityId,
            matterGrantId: context.matterGrantId,
            matterType,
            matterId,
            documentId: row.id,
            versionId: pinnedVersion.id,
            versionNo: pinnedVersion.versionNo,
            delivery: 'served_by_route',
            sizeBytes: bytes.length,
            checksumSha256: checksum,
          },
        });
        return true;
      });
      if (!released) return externalForbidden();
    } catch (error) {
      logger.error('External document download could not be recorded', { documentId: row.id, error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Download is unavailable' }, { status: 503 });
    }

    const name = documentAttachmentName(row.filename ?? row.title ?? row.name);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': row.mimeType || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
