/**
 * Single voting session route
 * GET   /api/voting/sessions/[id] — get session with options
 * PATCH /api/voting/sessions/[id] — update session
 * DELETE /api/voting/sessions/[id] — delete session
 */
import { withApi, z } from '@/lib/api/framework';
import {
  getVotingSessionById,
  updateVotingSession,
  deleteVotingSession,
} from '@/lib/services/voting-service';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'Get voting session',
      description: 'Returns a single voting session with its options.',
    },
  },
  async ({ params }) => {
    const session = await getVotingSessionById(params.id, true);
    if (!session) {
      const { ApiError } = await import('@/lib/api/errors');
      throw ApiError.notFound('Voting session');
    }
    return { ...session };
  }
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']).optional(),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
    }),
    openapi: {
      tags: ['Governance'],
      summary: 'Update voting session',
      description: 'Update a voting session. Requires steward role.',
    },
  },
  async ({ params, body }) => {
    const updated = await updateVotingSession(params.id, {
      ...body,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
    });
    if (!updated) {
      const { ApiError } = await import('@/lib/api/errors');
      throw ApiError.notFound('Voting session');
    }
    return updated;
  }
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Governance'],
      summary: 'Delete voting session',
      description: 'Delete a voting session. Requires steward role.',
    },
  },
  async ({ params }) => {
    await deleteVotingSession(params.id);
    return { deleted: true };
  }
);
