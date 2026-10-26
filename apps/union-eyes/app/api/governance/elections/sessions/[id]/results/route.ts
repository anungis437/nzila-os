/**
 * GET /api/governance/elections/sessions/[id]/results
 * Aggregated vote results for a session — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votes, votingOptions, votingSessions } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Get election results' },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/sessions/')[1]?.split('/results')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [session] = await db
      .select()
      .from(votingSessions)
      .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
    if (!session) throw ApiError.notFound('Voting session not found');

    const options = await db.select().from(votingOptions).where(eq(votingOptions.sessionId, id));

    // Tallies are withheld until the session is closed so a running count
    // cannot be observed. Even a closed tally is NOT a certified result:
    // certification requires a separate, independently authorized step.
    if (session.status !== 'closed') {
      return { session, options, results: [], totalVotes: null, resultsWithheld: true, certification: 'NOT_CERTIFIED' };
    }

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
      resultsWithheld: false,
      certification: 'NOT_CERTIFIED',
    };
  },
);

