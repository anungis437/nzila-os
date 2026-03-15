/**
 * GET PATCH DELETE /api/clause-library/[id]
 * Direct DB — replaces Django proxy
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

async function getClauseWithDetails(id: string, userId?: string) {
  const rows = await db
    .select({
      id: sharedClauseLibrary.id,
      clauseNumber: sharedClauseLibrary.clauseNumber,
      clauseTitle: sharedClauseLibrary.clauseTitle,
      clauseText: sharedClauseLibrary.clauseText,
      clauseType: sharedClauseLibrary.clauseType,
      sharingLevel: sharedClauseLibrary.sharingLevel,
      sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds,
      isAnonymized: sharedClauseLibrary.isAnonymized,
      originalEmployerName: sharedClauseLibrary.originalEmployerName,
      anonymizedEmployerName: sharedClauseLibrary.anonymizedEmployerName,
      sector: sharedClauseLibrary.sector,
      province: sharedClauseLibrary.province,
      effectiveDate: sharedClauseLibrary.effectiveDate,
      expiryDate: sharedClauseLibrary.expiryDate,
      viewCount: sharedClauseLibrary.viewCount,
      version: sharedClauseLibrary.version,
      sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
      organizationName: organizations.name,
      createdBy: sharedClauseLibrary.createdBy,
      createdAt: sharedClauseLibrary.createdAt,
      updatedAt: sharedClauseLibrary.updatedAt,
    })
    .from(sharedClauseLibrary)
    .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
    .where(eq(sharedClauseLibrary.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));

  return {
    id: r.id,
    clauseNumber: r.clauseNumber,
    clauseTitle: r.clauseTitle,
    clauseText: r.clauseText,
    clauseType: r.clauseType,
    sharingLevel: r.sharingLevel,
    sharedWithOrgIds: r.sharedWithOrgIds,
    isAnonymized: r.isAnonymized,
    originalEmployerName: r.originalEmployerName,
    anonymizedEmployerName: r.anonymizedEmployerName,
    sector: r.sector,
    province: r.province,
    effectiveDate: r.effectiveDate,
    expiryDate: r.expiryDate,
    viewCount: r.viewCount,
    version: r.version,
    sourceOrganization: { id: r.sourceOrganizationId, organizationName: r.organizationName },
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    tags: tags.map((t) => ({ id: t.id, tagName: t.tagName })),
    isOwner: userId ? r.createdBy === userId : false,
  };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get clause by ID' },
  },
  async ({ request, userId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;

    return withSystemContext(async () => {
      const clause = await getClauseWithDetails(id, userId ?? undefined);
      if (!clause) {
        throw ApiError.notFound('clause', id);
      }
      return clause;
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Update a shared clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    const body = await request.json();

    return withSystemContext(async () => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.clauseTitle !== undefined) updateData.clauseTitle = body.clauseTitle;
      if (body.clauseText !== undefined) updateData.clauseText = body.clauseText;
      if (body.clauseType !== undefined) updateData.clauseType = body.clauseType;
      if (body.clauseNumber !== undefined) updateData.clauseNumber = body.clauseNumber;
      if (body.sharingLevel !== undefined) updateData.sharingLevel = body.sharingLevel;
      if (body.sector !== undefined) updateData.sector = body.sector;
      if (body.province !== undefined) updateData.province = body.province;
      if (body.effectiveDate !== undefined) updateData.effectiveDate = body.effectiveDate;
      if (body.expiryDate !== undefined) updateData.expiryDate = body.expiryDate;
      if (body.isAnonymized !== undefined) updateData.isAnonymized = body.isAnonymized;
      if (body.originalEmployerName !== undefined) updateData.originalEmployerName = body.originalEmployerName;
      if (body.anonymizedEmployerName !== undefined) updateData.anonymizedEmployerName = body.anonymizedEmployerName;
      if (body.sharedWithOrgIds !== undefined) updateData.sharedWithOrgIds = body.sharedWithOrgIds;

      const [updated] = await db
        .update(sharedClauseLibrary)
        .set(updateData)
        .where(eq(sharedClauseLibrary.id, id))
        .returning();

      if (!updated) {
        throw ApiError.notFound('clause', id);
      }
      return { success: true, clause: updated };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Delete a shared clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;

    return withSystemContext(async () => {
      const [deleted] = await db
        .delete(sharedClauseLibrary)
        .where(eq(sharedClauseLibrary.id, id))
        .returning({ id: sharedClauseLibrary.id });

      if (!deleted) {
        throw ApiError.notFound('clause', id);
      }
      return { success: true };
    });
  },
);

