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
 * Every read and write runs in the caller's tenant RLS context. ue_shared_library_update
 * and ue_shared_library_delete restrict writes to the source org, matching
 * isSharedClauseOwner, and the select policies (owner, explicit share and public)
 * admit exactly what canReadSharedClause admits. Federation and congress sharing
 * are readable by the owner only (see lib/clause-library/sharing-authority.ts).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { and, eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { canReadSharedClause, isSharedClauseOwner, sharingChangeDenial, sourceNamesFor } from '@/lib/clause-library/sharing-authority';
import { parseClauseBody, assertMayPublish } from '@/lib/clause-library/clause-body';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';
import { clauseTextSha256, recordClauseVersion } from '@/lib/clause-library/version-history';

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
      createdBy: sharedClauseLibrary.createdBy,
      createdAt: sharedClauseLibrary.createdAt,
      updatedAt: sharedClauseLibrary.updatedAt,
    })
    .from(sharedClauseLibrary)
    .where(eq(sharedClauseLibrary.id, id))
    .limit(1);

  return rows[0] ?? null;
}

function formatClause(
  r: Awaited<ReturnType<typeof getClauseRow>>,
  callerOrgId: string | null,
  tags: { id: string; tagName: string }[],
  sourceName: string | null,
) {
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
    originalEmployerName: isOwner || r!.isAnonymized === false ? r!.originalEmployerName : undefined,
    anonymizedEmployerName: r!.anonymizedEmployerName,
    sector: r!.sector,
    province: r!.province,
    effectiveDate: r!.effectiveDate,
    expiryDate: r!.expiryDate,
    viewCount: r!.viewCount,
    version: r!.version,
    sourceOrganization: clauseSourceProjection({ ...r!, organizationName: sourceName }, callerOrgId ?? ''),
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

    // As the tenant: the policy withholds what this organization may not read, and canReadSharedClause states the same rule.
    return withRLSContext({ organizationId }, async () => {
      const row = await getClauseRow(id);
      if (!row || !(await canReadSharedClause(organizationId, row))) {
        throw ApiError.notFound('clause', id);
      }
      const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));
      const sourceNames = await sourceNamesFor([row], organizationId);
      return formatClause(row, organizationId, tags, sourceNames.get(row.sourceOrganizationId) ?? null);
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

    return withRLSContext({ organizationId }, async (tx) => {
      const existing = await getClauseRow(id, tx);
      // Fail closed identically whether the row is missing or the caller
      // simply isn't its owner — broad reader visibility never implies
      // write authority (round 55). Tenant RLS hides non-visible rows;
      // the owner predicate still rejects public/explicit-share readers.
      if (!existing || !isSharedClauseOwner(organizationId, existing)) {
        throw ApiError.notFound('clause', id);
      }

      // Judged against the level the clause has now, so a clause stored at a level that is no longer offered can still be edited.
      const denial = await sharingChangeDenial(organizationId, body, existing.sharingLevel);
      if (denial) {
        throw denial.status === 403 ? ApiError.forbidden(denial.message) : ApiError.badRequest(denial.message);
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

      // A change to what the clause says raises its version, so a reader who compared or cited it can tell it has changed. The audit keeps
      // a digest of the text it replaced.
      const contentChanged = (['clauseTitle', 'clauseText', 'clauseType'] as const).some(
        (field) => body[field] !== undefined && body[field] !== existing[field],
      );
      if (contentChanged) updateData.version = (existing.version ?? 1) + 1;

      // The text being replaced is kept, in this transaction, before it is overwritten.
      if (contentChanged) {
        await recordClauseVersion(tx, { organizationId, recordedBy: userId, kind: 'replaced', clause: existing });
      }

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
          ...(contentChanged
            ? {
                fromVersion: existing.version ?? 1,
                toVersion: updateData.version,
                replacedTextSha256: clauseTextSha256(existing.clauseText),
              }
            : {}),
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

      // A clause that is shared beyond its owner has been compared and cited by others, and the delete also removes its tags for good, so
      // it is withdrawn from sharing first (sharingLevel private) and only then removed.
      if (existing.sharingLevel !== 'private') {
        throw ApiError.conflict('This clause is shared. Withdraw it from sharing (set its sharing level to private) before deleting it.');
      }

      // The final text is kept before the row goes, so a deleted clause can still be shown as it was.
      await recordClauseVersion(tx, { organizationId, recordedBy: userId, kind: 'deleted', clause: existing });

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
        details: {
          clauseNumber: existing.clauseNumber,
          clauseTitle: existing.clauseTitle,
          clauseType: existing.clauseType,
          version: existing.version ?? 1,
          sharingLevel: existing.sharingLevel,
          clauseTextSha256: clauseTextSha256(existing.clauseText),
        },
      });
      return { success: true };
    });
  },
);

