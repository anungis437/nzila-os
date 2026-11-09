import { and, eq, isNull } from 'drizzle-orm';
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

/** A header-safe file name: no path, quotes, control characters or non-ASCII fallback surprises. */
function attachmentName(raw: string | null | undefined): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'document';
}

export const GET = withExternalMatterResourceAuth(
  {
    requiredPermission: 'download_documents',
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
      });
      if (!decision.allowed) {
        return { kind: 'forbidden' as const };
      }

      const [row] = await tx
        .select({
          id: documents.id,
          title: documents.title,
          name: documents.name,
          filename: documents.filename,
          mimeType: documents.mimeType,
        })
        .from(documents)
        .innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
        .where(
          and(
            eq(documents.id, documentId),
            eq(documents.organizationId, organizationId),
            eq(documents.status, 'active'),
            isNull(documents.deletedAt),
            eq(documentLinks.linkedEntityType, 'grievance'),
            eq(documentLinks.linkedEntityId, matterId),
          ),
        )
        .limit(1);

      if (!row) {
        return { kind: 'not_found' as const };
      }

      // Every grant must name the reviewed version. A legacy null pin is ambiguous and therefore authorizes no download; it must be
      // reissued after a person reviews the intended artifact. It must never silently widen to the current/latest version.
      const pinned = decision.documentVersionNo ?? null;
      if (pinned === null) return { kind: 'forbidden' as const };
      const [pinnedVersion] = await tx
        .select({ id: documentVersions.id, versionNo: documentVersions.versionNo, storageKey: documentVersions.storageKey })
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.organizationId, organizationId),
            eq(documentVersions.documentId, row.id),
            eq(documentVersions.versionNo, pinned),
          ),
        )
        .limit(1);

      return { kind: 'located' as const, row, pinnedVersion };
    });

    if (located.kind === 'forbidden') {
      return externalForbidden();
    }
    if (located.kind === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { row, pinnedVersion } = located;

    if (!pinnedVersion?.storageKey) {
      return NextResponse.json({ error: 'Download is not available' }, { status: 404 });
    }

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

    // The access is on the record before any byte leaves the server, and it names what is delivered.
    try {
      await withRLSContext({ organizationId }, (tx) =>
        persistAtomicAudit(tx, {
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
          },
        }),
      );
    } catch (error) {
      logger.error('External document download could not be recorded', { documentId: row.id, error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Download is unavailable' }, { status: 503 });
    }

    const name = attachmentName(row.filename ?? row.title ?? row.name);
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
