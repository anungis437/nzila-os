/**
 * POST /api/governance/reserved-matters/[id]/class-b-vote
 * Records the Class B (golden share council) vote on a reserved matter.
 *
 * Platform corporate governance only (GOVERNANCE_SYSTEM_ROLES). The voting
 * principal is the authenticated session user: client-supplied council
 * membership is ignored, and a matter can be decided once while pending.
 */
import { withApi, z } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';
import { auditDataMutation } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    entitlement: 'governance_suite',
    body: z.object({
      vote: z.enum(['approve', 'veto']),
      voteRationale: z.string().optional(),
    }),
  },
  async ({ body, params, userId, organizationId }) => {
    if (!userId) throw ApiError.unauthorized('Authenticated user required');
    const id = params.id;
    const newStatus = body.vote === 'veto' ? 'vetoed' : 'approved';

    const result = await withSystemContext(async () => {
      const rows = await db.execute(sql`
        SELECT status, class_b_vote FROM reserved_matter_votes
        WHERE id = ${id}::uuid FOR UPDATE
      `);
      const matter = Array.from(rows)[0] as { status: string; class_b_vote: string | null } | undefined;
      if (!matter) throw ApiError.notFound('Reserved matter');
      if (matter.status !== 'pending' || matter.class_b_vote) {
        throw ApiError.conflict('This reserved matter has already been decided.');
      }

      const voter = JSON.stringify([{ userId, recordedBy: 'session' }]);
      await db.execute(sql`
        UPDATE reserved_matter_votes
        SET class_b_vote = ${body.vote},
            class_b_vote_rationale = ${body.voteRationale ?? ''},
            class_b_council_members_voting = ${voter}::jsonb,
            status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `);
      return { updated: true, status: newStatus };
    });

    await auditDataMutation({
      userId,
      organizationId: organizationId ?? 'platform',
      resource: 'reserved_matter_votes',
      resourceId: id,
      action: 'update',
      details: { classBVote: body.vote, scope: 'platform_corporate_governance' },
    }).catch(() => undefined);
    return result;
  },
);

