/**
 * Mark a conversation read for the caller. Participant-scoped like every other conversation route; the marker records
 * only when the caller last opened it, so the other side can be shown "read" without being told by whom.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { markThreadRead } from '@/lib/messaging/thread-read-state';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Messages'], summary: 'Mark a conversation read' } },
  async ({ params }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => markThreadRead(tx, actor, params.threadId));
    if (result.kind === 'not_found') throw ApiError.notFound('Conversation');
    return NextResponse.json({ data: { changed: result.changed } });
  },
);
