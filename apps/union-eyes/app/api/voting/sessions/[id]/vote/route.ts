/**
 * Vote casting route
 * POST /api/voting/sessions/[id]/vote — cast a vote
 * GET  /api/voting/sessions/[id]/vote — check if current user has voted
 */
import { withApi, z } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import { castVote, hasVoted, getVotingSessionById } from '@/lib/services/voting-service';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { recordBallotAcceptance } from '@/lib/voting/ballot-process-audit';

export const dynamic = 'force-dynamic';

async function requireOpenOwnedSession(sessionId: string, organizationId: string | null, requireActive: boolean) {
  const session = await getVotingSessionById(sessionId);
  if (!session || !organizationId || session.organizationId !== organizationId) {
    throw ApiError.notFound('Voting session');
  }
  if (requireActive && session.status !== 'active') {
    throw ApiError.badRequest('Voting session is not open');
  }
}

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: z.object({
      optionId: z.guid(),
      isAnonymous: z.boolean().optional().default(true),
    }),
    openapi: {
      tags: ['Governance'],
      summary: 'Cast a vote',
      description: 'Cast a vote in an open voting session. Validates organization, eligibility and prevents double voting.',
    },
  },
  async ({ body, userId, organizationId, params }) => {
    const sessionId = params.id;
    if (body.isAnonymous === false) {
      throw ApiError.badRequest('Open-roll voting is not available: ballots are secret.');
    }
    await requireOpenOwnedSession(sessionId, organizationId, true);
    const vote = await castVote(sessionId, body.optionId, userId!, body.isAnonymous);
    await withRLSContext({ organizationId: organizationId! }, (tx) =>
      recordBallotAcceptance(tx, { organizationId: organizationId!, sessionId, receiptId: vote.id }),
    );

    // Receipt only: the ballot choice and voter identifier are not echoed back.
    return { vote: { id: vote.id, sessionId: vote.sessionId, castAt: vote.castAt }, receiptId: vote.receiptId };
  }
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'Check vote status',
      description: 'Check if the current user has already voted in this session.',
    },
  },
  async ({ userId, organizationId, params }) => {
    const sessionId = params.id;
    await requireOpenOwnedSession(sessionId, organizationId, false);
    const voted = await hasVoted(sessionId, userId!);
    return { hasVoted: voted };
  }
);
