/**
 * GET POST /api/communications/polls/:pollId/vote
 *
 * Not implemented. Voting cannot run through this path: poll_votes is denied in the CRUD governance table, so the generic poll-vote CRUD refused every caller with a misleading 403 instead of recording or reading a vote. It now answers HTTP 501 and reads and writes nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Communications'],
      summary: '/api/communications/polls/:pollId/vote (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/communications/polls/:pollId/vote is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
