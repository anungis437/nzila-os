/**
 * GET POST DELETE /api/clause-library/[id]/tags
 * Direct DB — replaces Django proxy
 *
 * Round 55: clause_library_tags inherits its parent clause's READ
 * visibility (canReadSharedClause) and OWNER-only WRITE authority — a
 * broader clause reader (federation/congress/public/explicit-grant) may
 * see tags but never add/remove them. DELETE-by-tagId additionally requires
 * the tag to belong to THIS clause id (round 55 fix: the prior code deleted
 * by tagId alone, letting a caller detach a tag row belonging to a
 * different — possibly another organization's — clause, as long as they
 * knew or guessed its id).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { clauseLibraryTags, sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { eq, and } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { canReadSharedClause, isSharedClauseOwner } from '@/lib/clause-library/sharing-authority';

export const dynamic = 'force-dynamic';

async function getClauseAuthorityRow(id: string) {
  const [clause] = await db
    .select({
      id: sharedClauseLibrary.id,
      sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
      sharingLevel: sharedClauseLibrary.sharingLevel,
      sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds,
    })
    .from(sharedClauseLibrary)
    .where(eq(sharedClauseLibrary.id, id))
    .limit(1);
  return clause ?? null;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get tags for a clause' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withSystemContext(async () => {
      const clause = await getClauseAuthorityRow(id);
      if (!clause || !(await canReadSharedClause(organizationId, clause))) {
        throw ApiError.notFound('clause', id);
      }

      const tags = await db
        .select()
        .from(clauseLibraryTags)
        .where(eq(clauseLibraryTags.clauseId, id));

      return { tags };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Add a tag to a clause' },
  },
  async ({ request, userId, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    const body = await request.json();
    const tagName = body.tagName || body.tag;
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    if (!tagName) {
      throw ApiError.badRequest('tagName is required');
    }

    return withSystemContext(async () => {
      const clause = await getClauseAuthorityRow(id);
      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      const [tag] = await db
        .insert(clauseLibraryTags)
        .values({
          clauseId: id,
          tagName: tagName.trim(),
          createdBy: userId || 'system',
        })
        .returning();

      return { tag };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Remove a tag from a clause' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    const body = await request.json();
    const tagName = body.tagName || body.tag;
    const tagId = body.tagId;
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    return withSystemContext(async () => {
      const clause = await getClauseAuthorityRow(id);
      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      if (tagId) {
        // clauseId is required here (not just tagId) — a tag row must
        // belong to THIS clause to be deletable via this route.
        await db
          .delete(clauseLibraryTags)
          .where(and(eq(clauseLibraryTags.id, tagId), eq(clauseLibraryTags.clauseId, id)));
      } else if (tagName) {
        await db
          .delete(clauseLibraryTags)
          .where(
            and(
              eq(clauseLibraryTags.clauseId, id),
              eq(clauseLibraryTags.tagName, tagName.trim()),
            ),
          );
      } else {
        throw ApiError.badRequest('tagId or tagName required');
      }

      return { success: true };
    });
  },
);

