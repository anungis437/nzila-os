/**
 * GET /api/governance/elections/sessions/[id]/results
 * Aggregated vote results for a session — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votes, votingOptions, votingSessions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'Get election results' },
  },
  async ({ request }) => {
    const id = request.url.split('/sessions/')[1]?.split('/results')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');

    const [session] = await db.select().from(votingSessions).where(eq(votingSessions.id, id));
    if (!session) throw ApiError.notFound('Voting session not found');

    const options = await db.select().from(votingOptions).where(eq(votingOptions.sessionId, id));

    const tallies = await db
      .select({
        optionId: votes.optionId,
        count: sql<number>`count(*)::int`,
      })
      .from(votes)
      .where(eq(votes.sessionId, id))
      .groupBy(votes.optionId);

    const totalVotes = tallies.reduce((sum, t) => sum + t.count, 0);

    return {
      session,
      options,
      results: tallies.map((t) => ({
        optionId: t.optionId,
        label: options.find((o) => o.id === t.optionId)?.text ?? 'Unknown',
        votes: t.count,
        percentage: totalVotes > 0 ? Math.round((t.count / totalVotes) * 10000) / 100 : 0,
      })),
      totalVotes,
    };
  },
);

