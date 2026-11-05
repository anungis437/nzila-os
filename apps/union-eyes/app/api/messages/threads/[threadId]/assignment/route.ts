/**
 * Assign, reassign or release a member conversation. Authority is being the current assignee or holding a live
 * triage designation; the decision, its history record, the notice to the new assignee and the audit commit
 * together. A thread the caller has no authority over is indistinguishable from a missing one (404).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { caseAssigneeEligible, getCaseActor } from '@/lib/cases/case-authorization';
import { inAppNoticeAllowed } from '@/lib/notifications/in-app-preferences';
import { assignThread, MAX_REASON } from '@/lib/messaging/thread-assignment';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['assign', 'reassign']), toStaffId: z.string().trim().min(1).max(255), reason: z.string().max(MAX_REASON).optional() }),
  z.object({ action: z.literal('release'), reason: z.string().max(MAX_REASON).optional() }),
]);

export const POST = withApi(
  { auth: { required: true, minRole: 'steward' }, body: bodySchema, openapi: { tags: ['Messages'], summary: 'Assign a conversation' } },
  async ({ params, body }) => {
    const actor = await getCaseActor();
    const result = await withRLSContext(async (tx) =>
      assignThread(
        tx,
        actor,
        { threadId: params.threadId, ...body },
        {
          assigneeEligible: (userId) => caseAssigneeEligible(tx, actor, userId),
          notifyAllowed: (recipientId) => inAppNoticeAllowed(recipientId, actor.organizationId, 'message'),
        },
      ),
    );
    switch (result.kind) {
      case 'ok':
        return NextResponse.json({ data: { action: result.action, staffId: result.staffId } });
      case 'not_found':
        throw ApiError.notFound('Conversation');
      case 'forbidden':
        throw ApiError.forbidden('You cannot assign your own conversation.');
      case 'closed':
        return NextResponse.json({ error: { code: 'THREAD_CLOSED', message: 'This conversation is closed.' } }, { status: 409 });
      case 'ineligible_assignee':
        return NextResponse.json({ error: { code: 'ASSIGNEE_NOT_ELIGIBLE', message: 'The assignee is not an eligible staff member.' } }, { status: 422 });
      case 'conflict':
        return NextResponse.json({ error: { code: result.code, message: 'The conversation is not in a state that allows this change.' } }, { status: 409 });
    }
  },
);
