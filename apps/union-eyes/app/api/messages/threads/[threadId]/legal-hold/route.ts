/**
 * Place or release a legal hold on one conversation. The kernel allows it only for a live
 * governance mandate that names this conversation and the action. The caller learns that the
 * conversation exists, never what it says, and the hold carries only a reference to the matter
 * requiring it. A hold does not stop participants from using the conversation; it stops the
 * conversation from ever being treated as eligible for disposition. The history record and the
 * audit commit together.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { HOLD_ACTIONS, MAX_HOLD_REFERENCE, setLegalHold } from '@/lib/messaging/thread-lifecycle';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.enum(HOLD_ACTIONS), reference: z.string().trim().min(1).max(MAX_HOLD_REFERENCE) });

export const POST = withApi(
  { auth: { required: true }, body: bodySchema, openapi: { tags: ['Messages'], summary: 'Place or release a legal hold' } },
  async ({ params, body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) => setLegalHold(tx, actor, params.threadId, body.action, body.reference));
    switch (result.kind) {
      case 'ok':
        return NextResponse.json({ data: { held: result.held } });
      case 'forbidden':
        throw ApiError.forbidden('A live governance mandate naming this conversation is required.');
      case 'not_found':
        throw ApiError.notFound('Conversation');
      case 'invalid_reference':
        throw ApiError.badRequest('A reference to the matter or authority is required.');
      case 'conflict':
        return NextResponse.json({ error: { code: result.code, message: 'The conversation is not in a state that allows this change.' } }, { status: 409 });
    }
  },
);
