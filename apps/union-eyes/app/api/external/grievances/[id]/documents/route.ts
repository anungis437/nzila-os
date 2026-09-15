import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { documentLinks, documents } from '@/db/schema/documents-schema';
import { externalDocumentAccessGrants } from '@/db/schema/representation-authority-schema';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';

export const GET = withExternalMatterResourceAuth(
  {
    requiredPermission: 'view_documents',
    resolve: resolveExternalGrievanceResource,
  },
  async (_request, context) => {
    if (context.matterType !== 'grievance') {
      return NextResponse.json({ error: 'Unsupported matter type' }, { status: 400 });
    }

    const rows = await db
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
        canDownload: externalDocumentAccessGrants.canDownload,
      })
      .from(externalDocumentAccessGrants)
      .innerJoin(documents, eq(documents.id, externalDocumentAccessGrants.documentId))
      .innerJoin(documentLinks, eq(documentLinks.documentId, documents.id))
      .where(
        and(
          eq(externalDocumentAccessGrants.authorityId, context.authorityId),
          eq(externalDocumentAccessGrants.matterGrantId, context.matterGrantId),
          eq(externalDocumentAccessGrants.organizationId, context.organizationId),
          eq(externalDocumentAccessGrants.userId, context.actor.userId),
          eq(externalDocumentAccessGrants.matterType, context.matterType),
          eq(externalDocumentAccessGrants.matterId, context.matterId),
          eq(externalDocumentAccessGrants.status, 'active'),
          eq(externalDocumentAccessGrants.canView, true),
          isNull(externalDocumentAccessGrants.revokedAt),
          or(isNull(externalDocumentAccessGrants.expiresAt), sql`${externalDocumentAccessGrants.expiresAt} > NOW()`),
          eq(documentLinks.linkedEntityType, 'grievance'),
          eq(documentLinks.linkedEntityId, context.matterId),
          eq(documents.organizationId, context.organizationId),
          eq(documents.status, 'active'),
          isNull(documents.deletedAt),
        ),
      )
      .orderBy(desc(documents.createdAt));

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        title: row.title ?? row.filename ?? row.name,
        filename: row.filename,
        documentType: row.documentType,
        mimeType: row.mimeType,
        privacyLabel: row.privacyLabel,
        canDownload: row.canDownload,
        uploadedAt: row.uploadedAt,
        createdAt: row.createdAt,
      })),
    });
  },
);
