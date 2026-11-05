/**
 * Close or archive a conversation. Authority is the thread's participant scope: its member or its current, live
 * assignee. The state change, its history record and the audit commit together; a conversation the caller cannot read is
 * indistinguishable from a missing one (404). Closing is final and no message text is ever recorded here.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { changeThreadLifecycle, LIFECYCLE_ACTIONS } from '@/lib/messaging/thread-lifecycle';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.enum(LIFECYCLE_ACTIONS) });

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, body: bodySchema, openapi: { tags: ['Messages'], summary: 'Close or archive a conversation' } },
  async ({ params, body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => changeThreadLifecycle(tx, actor, params.threadId, body.action));
    if (result.kind === 'not_found') throw ApiError.notFound('Conversation');
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: { code: result.code, message: 'The conversation is not in a state that allows this change.' } }, { status: 409 });
    }
    return NextResponse.json({ data: { action: result.action } });
  },
);
