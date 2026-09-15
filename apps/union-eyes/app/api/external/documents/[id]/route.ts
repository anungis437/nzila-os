import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { documentLinks, documents } from '@/db/schema/documents-schema';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import {
  badExternalResourceRequest,
  externalForbidden,
  resolveExternalDocumentResource,
} from '@/lib/external-resource-route-utils';
import { authorizeExternalDocumentAccess } from '@/lib/services/external-resource-authorization-service';

export const GET = withExternalMatterResourceAuth(
  {
    requiredPermission: 'view_documents',
    resolve: resolveExternalDocumentResource,
  },
  async (request, context, params?: { id?: string }) => {
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
      requiredPermission: 'view',
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
        documentType: documents.documentType,
        mimeType: documents.mimeType,
        privacyLabel: documents.privacyLabel,
        uploadedAt: documents.uploadedAt,
        createdAt: documents.createdAt,
        linkedEntityType: documentLinks.linkedEntityType,
        linkedEntityId: documentLinks.linkedEntityId,
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

    return NextResponse.json({
      data: {
        id: row.id,
        title: row.title ?? row.filename ?? row.name,
        filename: row.filename,
        documentType: row.documentType,
        mimeType: row.mimeType,
        privacyLabel: row.privacyLabel,
        uploadedAt: row.uploadedAt,
        createdAt: row.createdAt,
      },
    });
  },
);
