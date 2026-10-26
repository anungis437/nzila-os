/**
 * GET POST /api/governance/reserved-matters
 * CRUD for reserved matter votes in PostgreSQL.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  // Platform-wide governance data (round 11): see golden-share/route.ts.
  { auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] }, entitlement: 'governance_suite' },
  async () => {
    return withSystemContext(async () => {
    const rows = await db.execute(sql`
      SELECT id, matter_type, title, description, proposed_by,
             voting_deadline, status, class_a_votes_for, class_a_votes_against,
             class_b_vote, created_at
      FROM reserved_matter_votes ORDER BY created_at DESC LIMIT 50
    `);
    return { votes: Array.from(rows) };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    entitlement: 'governance_suite',
    body: z.object({
      matterType: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      proposedBy: z.string().optional(), // ignored: the proposer is always the session user
      votingDeadline: z.string().optional(),
      classATotalVotes: z.number().int().optional(),
      matterDetails: z.record(z.string(), z.unknown()).optional(),
    }),
  },
  async ({ body, userId, organizationId }) => {
    const id = await withSystemContext(async () => {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO reserved_matter_votes (
          id, created_at, updated_at, matter_type, title, description,
          proposed_by, voting_deadline, class_a_total_votes, matter_details, status
        ) VALUES (
          ${id}::uuid, NOW(), NOW(), ${body.matterType}, ${body.title},
          ${body.description}, ${userId!},
          ${body.votingDeadline ? body.votingDeadline : null}::timestamptz,
          ${body.classATotalVotes ?? 0},
          ${JSON.stringify(body.matterDetails ?? {})}::jsonb,
          'pending'
        )
      `);
      await persistAtomicAudit(db as unknown as RLSTx, {
        userId: userId!,
        organizationId: organizationId!,
        action: 'governance.reserved_matter.create',
        resourceType: 'reserved_matter_votes',
        resourceId: id,
        details: { matterType: body.matterType, title: body.title, proposedBy: userId },
      });
      return id;
    });
    return { id };
  },
);

