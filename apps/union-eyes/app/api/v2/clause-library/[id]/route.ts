/**
 * GET PATCH DELETE /api/v2/clause-library/[id]
 * Direct DB — replaces Django proxy
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

async function getClauseWithDetails(id: string, userId: string | undefined) {
  const [row] = await db
    .select({
      id: sharedClauseLibrary.id, clauseNumber: sharedClauseLibrary.clauseNumber,
      clauseTitle: sharedClauseLibrary.clauseTitle, clauseText: sharedClauseLibrary.clauseText,
      clauseType: sharedClauseLibrary.clauseType, sharingLevel: sharedClauseLibrary.sharingLevel,
      sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds,
      isAnonymized: sharedClauseLibrary.isAnonymized,
      originalEmployerName: sharedClauseLibrary.originalEmployerName,
      anonymizedEmployerName: sharedClauseLibrary.anonymizedEmployerName,
      sector: sharedClauseLibrary.sector, province: sharedClauseLibrary.province,
      effectiveDate: sharedClauseLibrary.effectiveDate, expiryDate: sharedClauseLibrary.expiryDate,
      viewCount: sharedClauseLibrary.viewCount, citationCount: sharedClauseLibrary.citationCount,
      comparisonCount: sharedClauseLibrary.comparisonCount, version: sharedClauseLibrary.version,
      sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
      organizationName: organizations.name, createdBy: sharedClauseLibrary.createdBy,
      createdAt: sharedClauseLibrary.createdAt, updatedAt: sharedClauseLibrary.updatedAt,
    })
    .from(sharedClauseLibrary)
    .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
    .where(eq(sharedClauseLibrary.id, id))
    .limit(1);
  if (!row) return null;
  const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));
  return { ...row, sourceOrganization: { id: row.sourceOrganizationId, organizationName: row.organizationName }, tags, isOwner: row.createdBy === userId };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get clause by ID with details' },
  },
  async ({ request, userId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/')[0];
    return withSystemContext(async () => {
      const clause = await getClauseWithDetails(id, userId ?? undefined);
      if (!clause) throw ApiError.notFound('clause', id);
      return { clause };
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Update clause fields' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/')[0];
    const body = await request.json();
    const allowedFields = ['clauseTitle', 'clauseText', 'clauseType', 'clauseNumber', 'sharingLevel', 'sector', 'province', 'effectiveDate', 'expiryDate', 'isAnonymized', 'anonymizedEmployerName'] as const;
    const updates: Record<string, unknown> = {};
    for (const f of allowedFields) { if (body[f] !== undefined) updates[f] = body[f]; }
    if (Object.keys(updates).length === 0) throw ApiError.badRequest('No fields to update');
    return withSystemContext(async () => {
      const [updated] = await db.update(sharedClauseLibrary).set({ ...updates, updatedAt: new Date() }).where(eq(sharedClauseLibrary.id, id)).returning();
      if (!updated) throw ApiError.notFound('clause', id);
      return { clause: updated };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Delete a clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/')[0];
    return withSystemContext(async () => {
      const [deleted] = await db.delete(sharedClauseLibrary).where(eq(sharedClauseLibrary.id, id)).returning({ id: sharedClauseLibrary.id });
      if (!deleted) throw ApiError.notFound('clause', id);
      return { success: true };
    });
  },
);
