/**
 * GET POST /api/governance/elections/sessions/[id]/vote
 * Cast a vote and read the caller's own participation status.
 *
 * Ballot secrecy: individual vote rows (option, voter id, voter hash, cast
 * time) are never returned by this route to any caller. Aggregate tallies are
 * served only by the officer-gated /results route.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { votingOptions, votingSessions } from '@/db/schema';
import { castVote, hasVoted } from '@/lib/services/voting-service';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const castVoteSchema = z.object({
  optionId: z.guid(),
  isAnonymous: z.boolean().default(true),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Get session ballot options and own participation status' },
  },
  async ({ request, organizationId, userId }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.unauthorized('Authenticated user required');

    const [session] = await db
      .select()
      .from(votingSessions)
      .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
    if (!session) throw ApiError.notFound('Voting session not found');

    const options = await db.select().from(votingOptions).where(eq(votingOptions.sessionId, id));

    return { session, options, hasVoted: await hasVoted(id, userId) };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Cast vote' },
  },
  async ({ request, body, organizationId, userId }) => {
    const id = request.url.split('/sessions/')[1]?.split('/vote')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.unauthorized('Authenticated user required');

    const parsed = castVoteSchema.parse(body);

    // Voter identity and eligibility are derived server-side from the
    // authenticated user via castVote() — never trust a client-supplied
    // voterId, which would let a caller impersonate/duplicate ballots.
    const vote = await withRLSContext({ organizationId }, async () => {
      const [session] = await db
        .select()
        .from(votingSessions)
        .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
      if (!session) throw ApiError.notFound('Voting session not found');
      if (session.status !== 'active') throw ApiError.badRequest('Voting session is not open');

      try {
        return await castVote(id, parsed.optionId, userId, parsed.isAnonymous);
      } catch (error) {
        throw ApiError.badRequest(error instanceof Error ? error.message : 'Failed to cast vote');
      }
    });

    // Receipt only: no option, voter identifier or hash is echoed back.
    return { id: vote.id, sessionId: vote.sessionId, castAt: vote.castAt };
  },
);

