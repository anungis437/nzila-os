/**
 * GET POST /api/v2/governance/reserved-matters
 * CRUD for reserved matter votes in PostgreSQL.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
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
    auth: { required: true, minRole: 'admin' },
    body: z.object({
      matterType: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      proposedBy: z.string().min(1),
      votingDeadline: z.string().optional(),
      classATotalVotes: z.number().int().optional(),
      matterDetails: z.record(z.unknown()).optional(),
    }),
  },
  async ({ body }) => {
    return withSystemContext(async () => {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO reserved_matter_votes (
          id, created_at, updated_at, matter_type, title, description,
          proposed_by, voting_deadline, class_a_total_votes, matter_details, status
        ) VALUES (
          ${id}::uuid, NOW(), NOW(), ${body.matterType}, ${body.title},
          ${body.description}, ${body.proposedBy},
          ${body.votingDeadline ? body.votingDeadline : null}::timestamptz,
          ${body.classATotalVotes ?? 0},
          ${JSON.stringify(body.matterDetails ?? {})}::jsonb,
          'pending'
        )
      `);
      return { id };
    });
  },
);
