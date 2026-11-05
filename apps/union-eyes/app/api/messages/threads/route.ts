/**
 * Conversation threads. Participation-scoped (lib/messaging/thread-access): a member reads and starts
 * only their own conversations. This route replaces the former org-wide CRUD handler.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { createMemberThread, listThreads, MAX_BODY, MAX_SUBJECT } from '@/lib/messaging/thread-access';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  subject: z.string().trim().min(1).max(MAX_SUBJECT),
  body: z.string().trim().min(1).max(MAX_BODY),
  clientRequestId: z.guid().optional(),
});

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Messages'], summary: 'List my conversations' } },
  async () => {
    const actor = await getCaseActor();
    const threads = await withRLSContext(async (tx) => listThreads(tx, actor));
    return { threads };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'member' }, body: createSchema, openapi: { tags: ['Messages'], summary: 'Start a conversation' } },
  async ({ body }) => {
    const actor = await getCaseActor();
    // Members start conversations about themselves; staff-initiated threads are not part of this contract.
    if (actor.role !== 'member') throw ApiError.forbidden('Only members can start a conversation here.');
    const thread = await withRLSContext(async (tx) => createMemberThread(tx, actor, body));
    return NextResponse.json({ data: { id: thread.id } }, { status: 201 });
  },
);
