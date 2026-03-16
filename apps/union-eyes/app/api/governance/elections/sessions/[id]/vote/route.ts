/**
 * GET POST /api/governance/elections/sessions/[id]/vote
 * Cast and view votes for a voting session — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votes, votingOptions, votingSessions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Governance'], summary: 'Get votes for session' },
  },
  async ({ request }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');

    const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, id));
    if (!session) throw ApiError.notFound('Voting session not found');

    const options = await db.select().from(votingOptions).where(eq(votingOptions.sessionId, id));
    const castVotes = await db.select().from(votes).where(eq(votes.sessionId, id)).orderBy(desc(votes.castAt));

    return { session, options, votes: castVotes };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Governance'], summary: 'Cast vote' },
  },
  async ({ request, body }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');

    const [vote] = await db.insert(votes).values({ ...(body as Record<string, unknown>), sessionId: id } as typeof votes.$inferInsert).returning();
    return { data: vote };
  },
);

