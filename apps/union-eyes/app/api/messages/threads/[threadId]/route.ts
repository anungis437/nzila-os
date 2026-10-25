/**
 * One conversation, participant-scoped. Replaces the former org-wide CRUD item handler. Besides the subject and state it
 * says what the viewer may do and where the conversation stands against the organization's retention policy; the member
 * is told only "not closed", "retention policy not adopted" or "retained", never about a legal hold.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { getThreadDetail } from '@/lib/messaging/thread-read-state';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Messages'], summary: 'Get a conversation' } },
  async ({ params }) => {
    const actor = await getCaseActor();
    const thread = await withRLSContext(async (tx) => getThreadDetail(tx, actor, params.threadId));
    if (!thread) throw ApiError.notFound('Conversation');
    return { thread };
  },
);
