/**
 * GET POST DELETE /api/v2/clause-library/[id]/tags
 * Direct DB — replaces Django proxy
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { clauseLibraryTags, sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { eq, and } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Get tags for a clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    return withSystemContext(async () => {
      const clause = await db.select({ id: sharedClauseLibrary.id }).from(sharedClauseLibrary).where(eq(sharedClauseLibrary.id, id)).limit(1);
      if (!clause.length) throw ApiError.notFound('clause', id);
      const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));
      return { tags };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Add a tag to a clause' },
  },
  async ({ request, userId }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    const body = await request.json();
    const tagName = body.tagName || body.tag;
    if (!tagName) throw ApiError.badRequest('tagName is required');
    return withSystemContext(async () => {
      const clause = await db.select({ id: sharedClauseLibrary.id }).from(sharedClauseLibrary).where(eq(sharedClauseLibrary.id, id)).limit(1);
      if (!clause.length) throw ApiError.notFound('clause', id);
      const [tag] = await db.insert(clauseLibraryTags).values({ clauseId: id, tagName: tagName.trim(), createdBy: userId || 'system' }).returning();
      return { tag };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Remove a tag from a clause' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const id = url.pathname.split('/clause-library/')[1]?.split('/tags')[0];
    const body = await request.json();
    const tagName = body.tagName || body.tag;
    const tagId = body.tagId;
    return withSystemContext(async () => {
      if (tagId) {
        await db.delete(clauseLibraryTags).where(eq(clauseLibraryTags.id, tagId));
      } else if (tagName) {
        await db.delete(clauseLibraryTags).where(and(eq(clauseLibraryTags.clauseId, id), eq(clauseLibraryTags.tagName, tagName.trim())));
      } else {
        throw ApiError.badRequest('tagId or tagName required');
      }
      return { success: true };
    });
  },
);
