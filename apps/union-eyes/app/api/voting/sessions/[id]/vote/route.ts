/**
 * Vote casting route
 * POST /api/voting/sessions/[id]/vote — cast a vote
 * GET  /api/voting/sessions/[id]/vote — check if current user has voted
 */
import { withApi, z } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import { castVote, hasVoted, getVotingSessionById } from '@/lib/services/voting-service';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';

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
      optionId: z.string().uuid(),
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
    await requireOpenOwnedSession(sessionId, organizationId, true);
    const vote = await castVote(sessionId, body.optionId, userId!, body.isAnonymous);

    // Evidence: every vote gets a tamper-proof audit trail
    buildUnionEvidencePack({
      actionType: 'VOTE_CAST',
      orgId: organizationId ?? 'unknown',
      actorId: userId!,
      artifacts: [{ type: 'vote', data: { sessionId, receiptId: vote.receiptId, isAnonymous: body.isAnonymous } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'VOTE_CAST' }))

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
