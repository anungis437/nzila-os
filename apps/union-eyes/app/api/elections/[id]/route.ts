/**
 * Council Election item route
 *
 * GET   /api/elections/[id]  — get a single election
 * PATCH /api/elections/[id]  — update an election
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { councilElections } from '@/db/schema/governance-schema';
import { eq } from 'drizzle-orm';
import { buildUnionEvidencePack } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';
import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { checkElectionUpdate } from '@/lib/voting/election-certification';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: { tags: ['Governance'], summary: 'Get a council election by ID' },
  },
  async ({ params }) => {
    const [election] = await withSystemContext(async (_tx) =>
      db
        .select()
        .from(councilElections)
        .where(eq(councilElections.id, params.id))
    );

    if (!election) throw ApiError.notFound('Election not found');
    return { data: election };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: { tags: ['Governance'], summary: 'Update a council election' },
  },
  async ({ request, params, organizationId, userId }) => {
    const body = await request.json();

    const ALLOWED: Array<keyof typeof councilElections.$inferInsert> = [
      'electionYear',
      'electionDate',
      'positionsAvailable',
      'candidates',
      'winners',
      'totalVotes',
      'participationRate',
      'verifiedBy',
      'verificationDate',
      'contestedResults',
    ];

    const updates: Partial<typeof councilElections.$inferInsert> = {};
    for (const key of ALLOWED) {
      if (key in body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updates as any)[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    updates.updatedAt = new Date();

    // Read, decide, write and audit in one system transaction under a row lock.
    const updated = await withSystemContext(async () => {
      const [existing] = await db.select().from(councilElections).where(eq(councilElections.id, params.id)).limit(1).for('update');
      if (!existing) throw ApiError.notFound('Election not found');
      const decision = checkElectionUpdate(existing, updates);
      if (!decision.ok) throw ApiError.conflict(decision.message);
      const [row] = await db.update(councilElections).set(updates).where(eq(councilElections.id, params.id)).returning();
      await persistAtomicAudit(db as unknown as RLSTx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'governance.council_election.update',
        resourceType: 'council_elections',
        resourceId: params.id,
        details: { fields: Object.keys(updates).filter((f) => f !== 'updatedAt'), certified: Boolean(existing.verificationDate || existing.verifiedBy), route: '/api/elections/[id]' },
      });
      return row;
    });

    buildUnionEvidencePack({
      actionType: 'ELECTION_UPDATED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'election', data: { electionId: params.id, fields: Object.keys(updates) } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'ELECTION_UPDATED' }));

    return { data: updated };
  },
);
