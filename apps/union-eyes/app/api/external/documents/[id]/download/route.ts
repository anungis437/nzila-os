import { and, desc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { documentLinks, documents, documentVersions } from '@/db/schema/documents-schema';
import { generateSasUrl } from '@/lib/blob-client';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import {
  badExternalResourceRequest,
  externalForbidden,
  resolveExternalDocumentResource,
} from '@/lib/external-resource-route-utils';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { authorizeExternalDocumentAccess } from '@/lib/services/external-resource-authorization-service';

const DOCUMENT_BLOB_CONTAINER = process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes';

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

    let downloadUrl: string;
    try {
      downloadUrl = await generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey);
    } catch {
      return NextResponse.json({ error: 'Download is not available' }, { status: 503 });
    }
    if (!downloadUrl) return NextResponse.json({ error: 'Download is not available' }, { status: 503 });

    // The access is on the record before the link leaves the server. The link itself is never recorded.
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
        },
      });
    } catch {
      return NextResponse.json({ error: 'Download is unavailable' }, { status: 503 });
    }

    return NextResponse.json({
      data: {
        id: row.id,
        title: row.title ?? row.filename ?? row.name,
        mimeType: row.mimeType,
        downloadUrl,
      },
    });
  },
);
