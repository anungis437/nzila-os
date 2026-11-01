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
 *
 * GET/POST/DELETE run in the caller's tenant RLS context. Child writes are
 * owner-only under ue_shared_library_child_write. The current select policy
 * admits the same permitted sharing visibility as canReadSharedClause.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import type { db } from '@/db/db';
import { clauseLibraryTags, sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { eq, and, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { canReadSharedClause, isSharedClauseOwner } from '@/lib/clause-library/sharing-authority';
import { parseClauseTagBody } from '@/lib/clause-library/tag-body';

export const dynamic = 'force-dynamic';

// clause_library_tags has no organization column: a tag belongs to its clause, and the clause to its source
// organization. The statement proves that ownership itself.
const tagOfOwnedClause = (clauseId: string, organizationId: string) =>
  sql`${clauseLibraryTags.clauseId} IN (SELECT id FROM shared_clause_library WHERE id = ${clauseId} AND source_organization_id = ${organizationId})`;

async function getClauseAuthorityRow(id: string, executor: typeof db) {
  const [clause] = await executor
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

    // As the tenant: the clause and its tags are admitted by the select policies (cache 0048 covers federation and congress), and
    // canReadSharedClause asks the same database function.
    return withRLSContext({ organizationId }, async (tx) => {
      const clause = await getClauseAuthorityRow(id, tx);
      if (!clause || !(await canReadSharedClause(organizationId, clause))) {
        throw ApiError.notFound('clause', id);
      }

      // The tag names and ids only: the author's user id is owner-internal and a reader of a shared clause does not receive it.
      const tags = await tx
        .select({ id: clauseLibraryTags.id, clauseId: clauseLibraryTags.clauseId, tagName: clauseLibraryTags.tagName })
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
    const { tagName } = parseClauseTagBody(await request.json().catch(() => null), 'add');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.badRequest('Authenticated user is required to add a tag.');

    if (!tagName) {
      throw ApiError.badRequest('tagName is required');
    }

    return withRLSContext({ organizationId }, async (tx) => {
      const clause = await getClauseAuthorityRow(id, tx);
      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      const [tag] = await tx
        .insert(clauseLibraryTags)
        .values({
          clauseId: id,
          tagName: tagName.trim(),
          createdBy: userId,
        })
        .returning();

      // ue_shared_library_child_write is owner-org only. A zero-row insert
      // must not be returned as a created tag.
      if (!tag) {
        throw ApiError.notFound('clause', id);
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.tag.add',
        resourceType: 'clause_library_tags',
        resourceId: tag.id,
        details: { clauseId: id, tagName: tag.tagName },
      });

      return { tag };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Remove a tag from a clause' },
  },
  async ({ request, userId, organizationId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    const { tagName, tagId } = parseClauseTagBody(await request.json().catch(() => null), 'remove');
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    if (!tagId && !tagName) throw ApiError.badRequest('tagId or tagName required');

    return withRLSContext({ organizationId }, async (tx) => {
      const clause = await getClauseAuthorityRow(id, tx);
      if (!clause || !isSharedClauseOwner(organizationId, clause)) {
        throw ApiError.notFound('clause', id);
      }

      // clauseId is required here (not just tagId) — a tag row must
      // belong to THIS clause to be deletable via this route.
      const removed = await tx
        .delete(clauseLibraryTags)
        .where(
          and(
            eq(clauseLibraryTags.clauseId, id),
            tagOfOwnedClause(id, organizationId),
            tagId ? eq(clauseLibraryTags.id, tagId) : eq(clauseLibraryTags.tagName, tagName!),
          ),
        )
        .returning({ id: clauseLibraryTags.id, tagName: clauseLibraryTags.tagName });

      if (removed.length === 0) {
        throw ApiError.notFound('tag', tagId ?? tagName ?? 'unknown');
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.tag.remove',
        resourceType: 'clause_library_tags',
        resourceId: removed[0].id,
        details: { clauseId: id, tagName: removed[0].tagName, removedCount: removed.length },
      });

      return { success: true };
    });
  },
);

