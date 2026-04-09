/**
 * CRUD item route for documents
 * Adds download audit logging + confidentiality enforcement + immutability guard
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { documents, caseDocuments } from '@/db/schema';
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { eq, and } from 'drizzle-orm';
import { logApiAuditEvent } from '@/lib/middleware/api-security';

export const dynamic = 'force-dynamic';

const crud = crudRoutes({
  table: documents,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});

/** GET with download audit trail + confidentiality enforcement */
export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Content'], summary: 'Get document by ID' },
  },
  async ({ request, organizationId, userId, user }) => {
    const id = request.url.split('/documents/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) return { error: 'Document ID required' };

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.organizationId, organizationId!)),
    });
    if (!doc || doc.deletedAt) return { error: 'Document not found' };

    // Confidentiality enforcement: restricted/confidential docs require steward+
    if (doc.isConfidential || doc.accessLevel === 'confidential' || doc.accessLevel === 'restricted') {
      const minRole = doc.accessLevel === 'confidential' ? 'admin' : 'steward';
      const roleHierarchy: Record<string, number> = { member: 20, steward: 50, admin: 140, super_admin: 160, app_owner: 200 };
      const currentRole = user?.role ?? '';
      if ((roleHierarchy[currentRole] ?? 0) < (roleHierarchy[minRole] ?? 0)) {
        return { error: 'Insufficient access level for this document' };
      }
    }

    // Audit: log document access/download
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId: userId ?? 'unknown',
      endpoint: `/api/documents/${id}`,
      method: 'GET',
      eventType: 'success',
      severity: 'low',
      details: {
        dataType: 'DOCUMENTS',
        action: 'document_access',
        documentId: id,
        organizationId,
        fileName: doc.name,
        isConfidential: doc.isConfidential,
      },
    });

    return { data: doc };
  },
);

export const PATCH = crud.PATCH;

/** DELETE with immutability guard for evidence-linked documents */
export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Content'], summary: 'Delete document (soft)' },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/documents/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) return { error: 'Document ID required' };

    // Check if document is immutable (linked as evidence)
    const immutableLink = await db.query.caseDocuments.findFirst({
      where: and(
        eq(caseDocuments.documentId, id),
        eq(caseDocuments.isImmutable, true),
      ),
    });

    if (immutableLink) {
      return { error: 'Cannot delete: document is linked as immutable evidence' };
    }

    // Soft delete
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId!)));

    return { success: true };
  },
);
