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
 *
 * Mutations run in the caller's tenant RLS context. ue_shared_library_update
 * and ue_shared_library_delete already restrict writes to the source org,
 * matching isSharedClauseOwner. GET stays on the system role: federation and
 * congress visibility is not expressed by ue_shared_library_select (owner,
 * explicit share, or public only) and must not be added by weakening RLS.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { and, eq } from 'drizzle-orm';
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { canReadSharedClause, isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';
import { parseClauseBody, assertMayPublish } from '@/lib/clause-library/clause-body';

export const dynamic = 'force-dynamic';

async function getClauseRow(id: string, executor: typeof db = db) {
  const rows = await executor
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
    originalEmployerName: isOwner || !r!.isAnonymized ? r!.originalEmployerName : undefined,
    anonymizedEmployerName: r!.anonymizedEmployerName,
    sector: r!.sector,
    province: r!.province,
    effectiveDate: r!.effectiveDate,
    expiryDate: r!.expiryDate,
    viewCount: r!.viewCount,
    version: r!.version,
    sourceOrganization: isOwner || !r!.isAnonymized ? { id: r!.sourceOrganizationId, organizationName: r!.organizationName } : undefined,
    createdBy: isOwner ? r!.createdBy : undefined,
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

    // PRIVILEGED_CROSS_TENANT_REVIEW: federation/congress readers are not
    // visible under ue_shared_library_select. Keep this read on the system
    // role and apply canReadSharedClause. Do not widen the runtime policy.
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
  async ({ request, userId, organizationId, user }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    const body = parseClauseBody(await request.json().catch(() => null), 'update');
    assertMayPublish(user?.role, body.sharingLevel);
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const denial = await withSystemContext(() => sharingChangeDenial(organizationId, body));
    if (denial) {
      throw denial.status === 403 ? ApiError.forbidden(denial.message) : ApiError.badRequest(denial.message);
    }

    return withRLSContext({ organizationId }, async (tx) => {
      const existing = await getClauseRow(id, tx);
      // Fail closed identically whether the row is missing or the caller
      // simply isn't its owner — broad reader visibility never implies
      // write authority (round 55). Tenant RLS hides non-visible rows;
      // the owner predicate still rejects public/explicit-share readers.
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

      const [updated] = await tx
        .update(sharedClauseLibrary)
        .set(updateData)
        .where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))
        .returning();

      if (!updated) {
        throw ApiError.notFound('clause', id);
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.update',
        resourceType: 'shared_clause_library',
        resourceId: id,
        details: {
          fields: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
          ...(updateData.sharingLevel !== undefined
            ? { fromSharingLevel: existing.sharingLevel, toSharingLevel: updateData.sharingLevel }
            : {}),
        },
      });
      return { success: true, clause: updated };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Delete a shared clause' },
  },
  async ({ request, userId, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop()!;
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    return withRLSContext({ organizationId }, async (tx) => {
      const existing = await getClauseRow(id, tx);
      if (!existing || !isSharedClauseOwner(organizationId, existing)) {
        throw ApiError.notFound('clause', id);
      }

      const [deleted] = await tx
        .delete(sharedClauseLibrary)
        .where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))
        .returning({ id: sharedClauseLibrary.id });

      if (!deleted) {
        throw ApiError.notFound('clause', id);
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.delete',
        resourceType: 'shared_clause_library',
        resourceId: id,
        details: { clauseNumber: existing.clauseNumber, sharingLevel: existing.sharingLevel },
      });
      return { success: true };
    });
  },
);

