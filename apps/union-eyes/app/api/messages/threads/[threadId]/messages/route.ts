/**
 * Messages in one conversation. Authority is the thread's participant scope; an unreadable and a
 * nonexistent thread are indistinguishable (404).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { inAppNoticeAllowed } from '@/lib/notifications/in-app-preferences';
import { listThreadMessages, MAX_BODY, postThreadMessage } from '@/lib/messaging/thread-access';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  body: z.string().trim().min(1).max(MAX_BODY),
  clientRequestId: z.guid().optional(),
});

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Messages'], summary: 'List messages in a conversation' } },
  async ({ params }) => {
    const actor = await getCaseActor();
    const rows = await withRLSContext(async (tx) => listThreadMessages(tx, actor, params.threadId));
    if (!rows) throw ApiError.notFound('Conversation');
    return { messages: rows };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, body: postSchema, openapi: { tags: ['Messages'], summary: 'Reply in a conversation' } },
  async ({ params, body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => postThreadMessage(tx, actor, params.threadId, body, (recipientId) => inAppNoticeAllowed(recipientId, actor.organizationId, 'message')));
    if (result.kind === 'not_found') throw ApiError.notFound('Conversation');
    if (result.kind === 'closed') {
      return NextResponse.json({ error: { code: 'THREAD_CLOSED', message: 'This conversation is closed.' } }, { status: 409 });
    }
    return NextResponse.json({ data: { message: result.message, duplicate: result.duplicate } }, { status: result.duplicate ? 200 : 201 });
  },
);
