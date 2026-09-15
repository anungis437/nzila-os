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
        fileUrl: documents.fileUrl,
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

    const [latestVersion] = await db
      .select({ storageKey: documentVersions.storageKey })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.organizationId, context.organizationId),
          eq(documentVersions.documentId, row.id),
        ),
      )
      .orderBy(desc(documentVersions.versionNo))
      .limit(1);

    const downloadUrl = latestVersion?.storageKey
      ? await generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey)
      : row.fileUrl;

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
