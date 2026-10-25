/**
 * GET PATCH DELETE /api/governance/elections/sessions/[id]
 * Single voting session operations — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { checkSessionUpdate } from '@/lib/voting/session-lifecycle';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSessionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  type: z.string().min(1).max(50).optional(),
  meetingType: z.string().min(1).max(50).optional(),
  status: z.enum(['draft', 'active', 'paused', 'closed', 'cancelled']).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  scheduledEndTime: z.coerce.date().optional(),
  allowAnonymous: z.boolean().optional(),
  requiresQuorum: z.boolean().optional(),
  quorumThreshold: z.number().int().min(0).max(100).optional(),
  totalEligibleVoters: z.number().int().min(0).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Get voting session by ID' },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [session] = await db
      .select()
      .from(votingSessions)
      .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
    if (!session) throw ApiError.notFound('Voting session not found');
    return session;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Update voting session' },
  },
  async ({ request, body, organizationId, userId }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const parsed = updateSessionSchema.parse(body);
    return withRLSContext(async (tx) => {
      const [current] = await tx
        .select()
        .from(votingSessions)
        .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
      if (!current) throw ApiError.notFound('Voting session not found');
      // An opened session's terms and a closed session's outcome are election evidence (G12).
      const decision = checkSessionUpdate(current.status, parsed);
      if (!decision.ok) throw ApiError.conflict(decision.message, { code: decision.code });
      const [session] = await tx
        .update(votingSessions)
        .set({ ...parsed, updatedAt: new Date() })
        .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)))
        .returning();
      if (!session) throw ApiError.notFound('Voting session not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId!,
        action: 'voting_session.update',
        resourceType: 'voting_sessions',
        resourceId: id,
        details: { fields: Object.keys(parsed), from: current.status, to: session.status },
      });
      return session;
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Cancel voting session' },
  },
  async ({ request, organizationId, userId }) => {
    const id = request.url.split('/sessions/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing session ID');
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    return withRLSContext(async (tx) => {
      const [current] = await tx
        .select()
        .from(votingSessions)
        .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)));
      if (!current) throw ApiError.notFound('Voting session not found');
      // A closed session cannot be cancelled: that would rewrite a completed election.
      const decision = checkSessionUpdate(current.status, { status: 'cancelled' });
      if (!decision.ok) throw ApiError.conflict(decision.message, { code: decision.code });
      const [session] = await tx
        .update(votingSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(votingSessions.id, id), eq(votingSessions.organizationId, organizationId)))
        .returning();
      if (!session) throw ApiError.notFound('Voting session not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId!,
        action: 'voting_session.cancel',
        resourceType: 'voting_sessions',
        resourceId: id,
        details: { from: current.status },
      });
      return session;
    });
  },
);

