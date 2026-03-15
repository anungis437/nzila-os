/**
 * POST /api/v2/governance/reserved-matters/[id]/class-b-vote
 * Records the Class B (golden share council) vote on a reserved matter.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    body: z.object({
      vote: z.enum(['approve', 'veto']),
      voteRationale: z.string().optional(),
      councilMembersVoting: z.array(z.record(z.unknown())).optional(),
    }),
  },
  async ({ body, params }) => {
    return withSystemContext(async () => {
      const id = params.id;
      const newStatus = body.vote === 'veto' ? 'vetoed' : 'approved';
      await db.execute(sql`
        UPDATE reserved_matter_votes
        SET class_b_vote = ${body.vote},
            class_b_vote_rationale = ${body.voteRationale ?? ''},
            class_b_council_members_voting = ${JSON.stringify(body.councilMembersVoting ?? [])}::jsonb,
            status = ${newStatus},
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `);
      return { updated: true, status: newStatus };
    });
  },
);
