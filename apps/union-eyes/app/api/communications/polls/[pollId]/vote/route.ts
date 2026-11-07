/**
 * GET POST /api/communications/polls/:pollId/vote
 *
 * POST records the caller's vote on an open poll of their own organization: one vote per member, enforced by the database's unique key on
 * (poll_id, user_id); a second vote is a 409 and changes nothing. GET returns the caller's own vote on the poll (or that they have not voted).
 * A poll of another organization is not found. The vote, the poll counters and the audit record commit together (lib/communications/polls.ts).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { castPollVote, castVoteSchema, readOwnPollVote } from '@/lib/communications/polls';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pollIdOf(params: Record<string, string>): string {
  const pollId = params.pollId;
  // A malformed id would reach the uuid column as a 500; it names no poll.
  if (typeof pollId !== 'string' || !UUID.test(pollId)) throw ApiError.notFound('Poll');
  return pollId;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Communications'], summary: 'The caller\'s vote on a poll', description: 'Whether the caller has voted on the poll, and for which option.' },
  },
  async ({ params, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('Organization context required');
    const pollId = pollIdOf(await params);
    return withRLSContext({ organizationId, userId }, (tx) => readOwnPollVote(tx, { organizationId, userId, pollId }));
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: castVoteSchema,
    openapi: { tags: ['Communications'], summary: 'Vote on a poll', description: 'Records the caller\'s single vote on an open poll of their organization.' },
  },
  async ({ params, body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('Organization context required');
    const pollId = pollIdOf(await params);
    return withRLSContext({ organizationId, userId }, (tx) => castPollVote(tx, { organizationId, userId, pollId, optionId: body.optionId }));
  },
);
