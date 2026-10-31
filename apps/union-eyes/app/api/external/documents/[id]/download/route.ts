import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { BlobTooLargeError, readBlobBounded } from '@/lib/blob-client';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import {
  badExternalResourceRequest,
  externalForbidden,
  resolveExternalDocumentResource,
} from '@/lib/external-resource-route-utils';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { authorizeExternalDocumentAccess } from '@/lib/services/external-resource-authorization-service';

/**
 * The file is served by this route, not handed over as a storage link. A link is a bearer URL: whoever holds it reads the file until
 * it expires, revoking the grant cannot recall it, and the audit row could only say a link was issued. Here the grant, its expiry and
 * its revocation are checked on every read, the bytes are only released after the access record is written, and that record names the
 * bytes actually delivered. A streamed read is bounded; a larger file is refused.
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
  },
  async (_request, context, params?: { id?: string }) => {
    if (!params?.id || !context.organizationId || !context.matterId) {
      return badExternalResourceRequest();
    }
    if (context.matterType !== 'grievance') {
      return NextResponse.json({ error: 'Unsupported matter type' }, { status: 400 });
    }

    const decision = await authorizeExternalDocumentAccess({
      actor: context.actor,
      organizationId: context.organizationId,
      matterType: context.matterType,
      matterId: context.matterId,
      documentId: params.id,
      requiredPermission: 'download',
    });
    if (!decision.allowed) {
      return externalForbidden();
    }

    const [row] = await db
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
          eq(documents.id, params.id),
          eq(documents.organizationId, context.organizationId),
          eq(documents.status, 'active'),
          isNull(documents.deletedAt),
          eq(documentLinks.linkedEntityType, 'grievance'),
          eq(documentLinks.linkedEntityId, context.matterId),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // A grant pinned to a version releases that version only; a version added later is not covered by it. An unpinned (earlier) grant
    // keeps releasing the current version.
    const pinned = decision.documentVersionNo ?? null;
    const [latestVersion] = await db
      .select({ id: documentVersions.id, versionNo: documentVersions.versionNo, storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, context.organizationId),
          eq(documentVersions.documentId, row.id),
          ...(pinned !== null ? [eq(documentVersions.versionNo, pinned)] : []),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1);

    if (!latestVersion?.storageKey) {
      return NextResponse.json({ error: 'Download is not available' }, { status: 404 });
    }

    let bytes: Buffer;
    try {
      bytes = await readBlobBounded(latestVersion.storageKey, EXTERNAL_DOWNLOAD_MAX_BYTES);
    } catch (error) {
      if (error instanceof BlobTooLargeError) {
        return NextResponse.json({ error: 'This file is too large to download here' }, { status: 413 });
      }
      return NextResponse.json({ error: 'Download is not available' }, { status: 503 });
    }

    // The access is on the record before any byte leaves the server, and it names what is delivered.
    try {
      await persistAtomicAudit(db as unknown as RLSTx, {
        organizationId: context.organizationId,
        userId: context.actor.userId,
        action: 'document.external_download',
        resourceType: 'documents',
        resourceId: row.id,
        details: {
          actorKind: 'external_representative',
          representativeOrganizationId: context.actor.representativeOrganizationId ?? null,
          authorityId: context.authorityId,
          matterGrantId: context.matterGrantId,
          matterType: context.matterType,
          matterId: context.matterId,
          documentId: row.id,
          versionId: latestVersion.id,
          versionNo: latestVersion.versionNo,
          delivery: 'served_by_route',
          sizeBytes: bytes.length,
        },
      });
    } catch {
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
