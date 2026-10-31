/**
 * GET POST /api/communications/sms/conversations/[conversationId]/read
 *
 * Not implemented. This path advertises marking a conversation read, but it was the generic SMS message collection: it ignored the
 * conversation id, listed every message of the organization and inserted a message row on POST, and nothing was marked read. It now
 * answers HTTP 501 and reads, writes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Communications'],
      summary: 'Mark an SMS conversation read (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Marking an SMS conversation read is not implemented: no read state is stored for conversations.');
  },
);

export const GET = handler;
export const POST = handler;
