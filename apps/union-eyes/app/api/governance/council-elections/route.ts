/**
 * GET POST /api/governance/council-elections
 * Records and retrieves council election results from PostgreSQL.
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' }, entitlement: 'governance_suite' },
  async () => {
    return withSystemContext(async () => {
    const rows = await db.execute(sql`
      SELECT id, election_year, election_date, positions_available,
             candidates, winners, total_votes, participation_rate,
             verified_by, verification_date, contested_results
      FROM council_elections ORDER BY election_date DESC LIMIT 50
    `);
    return { elections: Array.from(rows) };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    body: z.object({
      electionYear: z.number().int(),
      electionDate: z.string().min(1),
      positionsAvailable: z.number().int(),
      candidates: z.array(z.record(z.unknown())),
      winners: z.array(z.record(z.unknown())),
      totalVotes: z.number().int(),
      participationRate: z.number().int().optional(),
    }),
  },
  async ({ body, userId, organizationId }) => {
    // The election record and its audit record commit together in one system transaction.
    const id = await withSystemContext(async () => {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO council_elections (
          id, created_at, updated_at, election_year, election_date,
          positions_available, candidates, winners,
          total_votes, participation_rate, contested_results
        ) VALUES (
          ${id}::uuid, NOW(), NOW(), ${body.electionYear},
          ${body.electionDate}::date, ${body.positionsAvailable},
          ${JSON.stringify(body.candidates)}::jsonb,
          ${JSON.stringify(body.winners)}::jsonb,
          ${body.totalVotes}, ${body.participationRate ?? 0}, false
        )
      `);
      await persistAtomicAudit(db as unknown as RLSTx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'governance.council_election.create',
        resourceType: 'council_elections',
        resourceId: id,
        details: { electionYear: body.electionYear, positionsAvailable: body.positionsAvailable, totalVotes: body.totalVotes },
      });
      return id;
    });
    return { id };
  },
);

