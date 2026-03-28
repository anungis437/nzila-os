/**
 * Vote casting route
 * POST /api/voting/sessions/[id]/vote — cast a vote
 * GET  /api/voting/sessions/[id]/vote — check if current user has voted
 */
import { withApi, z } from '@/lib/api/framework';
import { castVote, hasVoted } from '@/lib/services/voting-service';

export const dynamic = 'force-dynamic';

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
      description: 'Cast a vote in a voting session. Validates eligibility and prevents double voting.',
    },
  },
  async ({ body, userId, params }) => {
    const sessionId = params.id;
    const vote = await castVote(sessionId, body.optionId, userId!, body.isAnonymous);
    return { vote, receiptId: vote.receiptId };
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
  async ({ userId, params }) => {
    const sessionId = params.id;
    const voted = await hasVoted(sessionId, userId!);
    return { hasVoted: voted };
  }
);
