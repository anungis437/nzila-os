/**
 * Unassigned member conversations awaiting triage. Metadata only (subject, category, priority, age): message
 * content and the member's identity stay with the assignee. Visible only to the holder of a live triage
 * designation; everyone else, including senior staff, receives the same 404 as for a route that does not exist.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { listTriageQueue } from '@/lib/messaging/thread-assignment';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'steward' }, openapi: { tags: ['Messages'], summary: 'Conversations awaiting assignment' } },
  async () => {
    const actor = await getCaseActor();
    const queue = await withRLSContext(async (tx) => listTriageQueue(tx, actor));
    if (!queue) throw ApiError.notFound('Queue');
    return { queue };
  },
);
