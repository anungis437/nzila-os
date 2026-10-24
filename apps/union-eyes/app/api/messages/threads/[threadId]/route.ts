/**
 * One conversation, participant-scoped. Replaces the former org-wide CRUD item handler.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { findReadableThread } from '@/lib/messaging/thread-access';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Messages'], summary: 'Get a conversation' } },
  async ({ params }) => {
    const actor = await getCaseActor();
    const thread = await withRLSContext(async (tx) => findReadableThread(tx, actor, params.threadId));
    if (!thread) throw ApiError.notFound('Conversation');
    return {
      thread: {
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        isArchived: Boolean(thread.isArchived),
        representativeAssigned: Boolean(thread.staffId),
      },
    };
  },
);
