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

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['Governance'], summary: 'Get a council election by ID' },
  },
  async ({ params }) => {
    const [election] = await db
      .select()
      .from(councilElections)
      .where(eq(councilElections.id, params.id));

    if (!election) throw ApiError.notFound('Election not found');
    return { data: election };
  },
);

export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
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
        (updates as unknown)[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(councilElections)
      .set(updates)
      .where(eq(councilElections.id, params.id))
      .returning();

    if (!updated) throw ApiError.notFound('Election not found');

    buildUnionEvidencePack({
      actionType: 'ELECTION_UPDATED',
      orgId: organizationId!,
      actorId: userId!,
      artifacts: [{ type: 'election', data: { electionId: params.id, fields: Object.keys(updates) } }],
    }).catch((err) => logger.warn('Evidence pack failed', { error: String(err), actionType: 'ELECTION_UPDATED' }));

    return { data: updated };
  },
);
