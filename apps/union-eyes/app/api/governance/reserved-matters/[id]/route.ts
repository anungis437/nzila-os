/**
 * PATCH /api/governance/reserved-matters/[id]
 * Records Class A vote results on a reserved matter.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const PATCH = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    entitlement: 'governance_suite',
    body: z.object({
      votesFor: z.number().int(),
      votesAgainst: z.number().int(),
      abstain: z.number().int().optional(),
    }),
  },
  async ({ body, params, userId, organizationId }) => {
    // The recorded result and its audit record commit together; a vote that matches no matter is a 404, not a success.
    return withSystemContext(async () => {
    const id = params.id;
    const updated = await db.execute(sql`
      UPDATE reserved_matter_votes
      SET class_a_votes_for = ${body.votesFor},
          class_a_votes_against = ${body.votesAgainst},
          class_a_abstain = ${body.abstain ?? 0},
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id
    `);
    if (Array.from(updated).length === 0) throw ApiError.notFound('Reserved matter');
    await persistAtomicAudit(db as unknown as RLSTx, {
      organizationId: organizationId!,
      userId: userId!,
      action: 'governance.reserved_matter.record_votes',
      resourceType: 'reserved_matter_votes',
      resourceId: id,
      details: { votesFor: body.votesFor, votesAgainst: body.votesAgainst, abstain: body.abstain ?? 0 },
    });
    return { updated: true };
    });
  },
);

