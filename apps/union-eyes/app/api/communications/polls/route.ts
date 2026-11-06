/**
 * GET POST /api/communications/polls
 *
 * GET lists the organization's polls (generic read; the table is READ_ONLY in the CRUD governance table, so nothing generic writes it).
 * POST creates a single-choice poll through the dedicated, audited path in lib/communications/polls.ts: the generic create it replaced
 * refused every request, so no poll could ever be created. Options get server-minted ids; status, publication time and counters are never
 * client-written.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { createPoll, createPollSchema } from '@/lib/communications/polls';
import { polls } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: polls,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: createPollSchema,
    openapi: {
      tags: ['Communications'],
      summary: 'Create a poll',
      description: 'Creates an open, single-choice poll in the caller\'s organization; each member may vote once.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!userId || !organizationId) throw ApiError.forbidden('Organization context required');
    return withRLSContext({ organizationId, userId }, (tx) => createPoll(tx, { organizationId, userId, input: body }));
  },
);
export { GET };
