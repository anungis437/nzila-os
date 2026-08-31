/**
 * GET /api/health-safety/stats
 * Cross-domain health & safety summary statistics (currently used by the
 * training overview page). Returns { trainingDue }.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Cross-domain health & safety summary statistics',
    },
  },
  async ({ organizationId }) => {
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const rows = Array.from(
      await withRLSContext(async () =>
        db.execute(sql`
          SELECT count(*)::int AS training_due
          FROM safety_training_records
          WHERE ${orgFilter}
            AND expiry_date IS NOT NULL
            AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days')
        `)
      )
    );

    const row = (rows[0] ?? {}) as Record<string, unknown>;

    return {
      trainingDue: Number(row.training_due ?? 0),
    };
  },
);
