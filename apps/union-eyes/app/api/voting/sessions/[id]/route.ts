/**
 * Single voting session route
 * GET   /api/voting/sessions/[id] — get session with options
 * PATCH /api/voting/sessions/[id] — update session
 * DELETE /api/voting/sessions/[id] — delete session
 */
import { withApi, z } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import {
  getVotingSessionById,
  updateVotingSession,
  deleteVotingSession,
} from '@/lib/services/voting-service';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { checkSessionDeletion, checkSessionUpdate } from '@/lib/voting/session-lifecycle';

export const dynamic = 'force-dynamic';

// A session outside the caller's organization is indistinguishable from a
// missing one, so cross-union callers cannot probe for session ids.
async function getOwnedSession(id: string, organizationId: string | null, includeOptions = false) {
  const session = await getVotingSessionById(id, includeOptions);
  if (!session || !organizationId || session.organizationId !== organizationId) {
    throw ApiError.notFound('Voting session');
  }
  return session;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Governance'],
      summary: 'Get voting session',
      description: 'Returns a single voting session with its options.',
    },
  },
  async ({ params, organizationId }) => {
    const session = await getOwnedSession(params.id, organizationId, true);
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
      description: 'Update a voting session. Requires steward role. Opened sessions cannot change terms or reopen once closed.',
    },
  },
  async ({ params, body, organizationId, userId }) => {
    const updated = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const session = await getOwnedSession(params.id, organizationId);
      const decision = checkSessionUpdate(session.status, body);
      if (!decision.ok) throw ApiError.conflict(decision.message, { code: decision.code });
      const row = await updateVotingSession(params.id, organizationId!, {
        ...body,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
      });
      if (!row) throw ApiError.notFound('Voting session');
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'voting_session.update',
        resourceType: 'voting_sessions',
        resourceId: params.id,
        details: { fields: Object.keys(body), from: session.status, to: row.status },
      });
      return row;
    });

    buildUnionEvidencePack({
      actionType: 'VOTING_SESSION_UPDATED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'voting_session', data: { sessionId: params.id, changes: body } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'VOTING_SESSION_UPDATED' }));

    return updated;
  }
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Governance'],
      summary: 'Delete voting session',
      description: 'Delete a draft voting session with no ballots. Requires steward role.',
    },
  },
  async ({ params, organizationId, userId }) => {
    await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const session = await getOwnedSession(params.id, organizationId, true);
      const decision = checkSessionDeletion(session.status, session.voteCount ?? 0);
      if (!decision.ok) throw ApiError.conflict(decision.message, { code: decision.code });
      await deleteVotingSession(params.id, organizationId!);
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'voting_session.delete',
        resourceType: 'voting_sessions',
        resourceId: params.id,
        details: { status: session.status },
      });
    });

    buildUnionEvidencePack({
      actionType: 'VOTING_SESSION_DELETED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'voting_session', data: { sessionId: params.id } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'VOTING_SESSION_DELETED' }));

    return { deleted: true };
  }
);
