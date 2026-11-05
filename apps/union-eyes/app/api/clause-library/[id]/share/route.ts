/**
 * GET POST /api/clause-library/[id]/share
 * Direct DB — replaces Django proxy
 *
 * Round 55 (OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY): sharing configuration
 * (sharingLevel, the explicit sharedWithOrgIds grant list) is owner-internal
 * — broad clause READERS (federation/congress/public/explicit-grant) never
 * see or change it. Both GET and POST here are owner-only.
 *
 * Owner SELECT and UPDATE are expressed by ue_shared_library_select /
 * ue_shared_library_update, so both handlers use the caller's tenant RLS
 * context. Organization id is taken from the session, never the body.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { and, eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';
import { parseClauseBody, assertMayPublish } from '@/lib/clause-library/clause-body';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get sharing info for a clause' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withRLSContext({ organizationId }, async (tx) => {
      const [clause] = await tx
        .select({
          id: sharedClauseLibrary.id,
          sharingLevel: sharedClauseLibrary.sharingLevel,
          sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds,
          isAnonymized: sharedClauseLibrary.isAnonymized,
          anonymizedEmployerName: sharedClauseLibrary.anonymizedEmployerName,
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
        })
        .from(sharedClauseLibrary)
        .where(eq(sharedClauseLibrary.id, id))
        .limit(1);

      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      return { sharing: clause };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Update sharing settings for a clause' },
  },
  async ({ request, userId, organizationId, user }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/share')[0];
    const body = parseClauseBody(await request.json().catch(() => null), 'share');
    assertMayPublish(user?.role, body.sharingLevel);
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const updates: Record<string, unknown> = {};
    if (body.sharingLevel !== undefined) updates.sharingLevel = body.sharingLevel;
    if (body.sharedWithOrgIds !== undefined) updates.sharedWithOrgIds = body.sharedWithOrgIds;
    if (body.isAnonymized !== undefined) updates.isAnonymized = body.isAnonymized;
    if (body.anonymizedEmployerName !== undefined) updates.anonymizedEmployerName = body.anonymizedEmployerName;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No sharing fields to update');
    }

    return withRLSContext({ organizationId }, async (tx) => {
      const [clause] = await tx
        .select({
          id: sharedClauseLibrary.id,
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          sharingLevel: sharedClauseLibrary.sharingLevel,
        })
        .from(sharedClauseLibrary)
        .where(eq(sharedClauseLibrary.id, id))
        .limit(1);

      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      // Judged against the level the clause has now, so re-sending a level that is no longer offered is not a change.
      const denial = await sharingChangeDenial(organizationId, updates, clause.sharingLevel);
      if (denial) {
        throw denial.status === 403 ? ApiError.forbidden(denial.message) : ApiError.badRequest(denial.message);
      }

      const [updated] = await tx
        .update(sharedClauseLibrary)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))
        .returning();

      // ue_shared_library_update is owner-org only. A zero-row write is the
      // same non-disclosure as a missing clause — do not read updated.id.
      if (!updated) {
        throw ApiError.notFound('clause', id);
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.sharing.update',
        resourceType: 'shared_clause_library',
        resourceId: id,
        details: {
          fields: Object.keys(updates),
          fromSharingLevel: clause.sharingLevel,
          toSharingLevel: updated.sharingLevel,
          explicitGrantCount: Array.isArray(updated.sharedWithOrgIds) ? updated.sharedWithOrgIds.length : 0,
        },
      });

      return {
        sharing: {
          id: updated.id,
          sharingLevel: updated.sharingLevel,
          sharedWithOrgIds: updated.sharedWithOrgIds,
          isAnonymized: updated.isAnonymized,
          anonymizedEmployerName: updated.anonymizedEmployerName,
        },
      };
    });
  },
);

