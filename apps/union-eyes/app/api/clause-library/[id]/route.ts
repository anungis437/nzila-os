/**
 * GET PATCH DELETE /api/clause-library/[id]
 * Direct DB — replaces Django proxy
 *
 * Round 55 (OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY): GET is gated by
 * canReadSharedClause (owner, or a sharingLevel that grants this caller's
 * org access); PATCH/DELETE remain owner-only regardless of sharingLevel —
 * broad reader visibility never implies write authority. `sharedWithOrgIds`
 * (the explicit private-grant list) is only returned to the owner — it is
 * owner-internal sharing configuration, not shared clause content.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { canReadSharedClause, isSharedClauseOwner } from '@/lib/clause-library/sharing-authority';

export const dynamic = 'force-dynamic';

async function getClauseRow(id: string) {
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

  return rows[0] ?? null;
}

function formatClause(r: Awaited<ReturnType<typeof getClauseRow>>, callerOrgId: string | null, tags: { id: string; tagName: string }[]) {
  const isOwner = callerOrgId ? r!.sourceOrganizationId === callerOrgId : false;
  return {
    id: r!.id,
    clauseNumber: r!.clauseNumber,
    clauseTitle: r!.clauseTitle,
    clauseText: r!.clauseText,
    clauseType: r!.clauseType,
    sharingLevel: r!.sharingLevel,
    // owner-internal sharing configuration — never exposed to a non-owner
    // reader, even one authorized to read the clause content itself.
    sharedWithOrgIds: isOwner ? r!.sharedWithOrgIds : undefined,
    isAnonymized: r!.isAnonymized,
    originalEmployerName: r!.originalEmployerName,
    anonymizedEmployerName: r!.anonymizedEmployerName,
    sector: r!.sector,
    province: r!.province,
    effectiveDate: r!.effectiveDate,
    expiryDate: r!.expiryDate,
    viewCount: r!.viewCount,
    version: r!.version,
    sourceOrganization: { id: r!.sourceOrganizationId, organizationName: r!.organizationName },
    createdBy: r!.createdBy,
    createdAt: r!.createdAt,
    updatedAt: r!.updatedAt,
    tags: tags.map((t) => ({ id: t.id, tagName: t.tagName })),
    isOwner,
  };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get clause by ID' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withSystemContext(async () => {
      const row = await getClauseRow(id);
      if (!row || !(await canReadSharedClause(organizationId, row))) {
        throw ApiError.notFound('clause', id);
      }
      const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));
      return formatClause(row, organizationId, tags);
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Update a shared clause' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    const body = await request.json();
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withSystemContext(async () => {
      const existing = await getClauseRow(id);
      // Fail closed identically whether the row is missing or the caller
      // simply isn't its owner — broad reader visibility never implies
      // write authority (round 55).
      if (!existing || !isSharedClauseOwner(organizationId, existing)) {
        throw ApiError.notFound('clause', id);
      }

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
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withSystemContext(async () => {
      const existing = await getClauseRow(id);
      if (!existing || !isSharedClauseOwner(organizationId, existing)) {
        throw ApiError.notFound('clause', id);
      }

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

