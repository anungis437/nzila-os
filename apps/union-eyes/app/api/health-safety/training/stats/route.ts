/**
 * GET /api/health-safety/training/stats
 * Training records overview for the TrainingPage cards.
 * Returns { totalRecords, certifiedMembers, expiringSoon, overdue }.
 * `expiringSoon` = certifications expiring within the next 30 days.
 * `overdue` = certifications past expiry.
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
      summary: 'Safety training summary stats',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const empty = { totalRecords: 0, certifiedMembers: 0, expiringSoon: 0, overdue: 0 };

    try {
      return await withRLSContext(async () => {
        const rows = Array.from(
          await db.execute(sql`
            SELECT
              count(*)::int AS total,
              count(DISTINCT trainee_id) FILTER (WHERE status = 'completed')::int AS certified,
              count(*) FILTER (
                WHERE expiry_date IS NOT NULL
                  AND expiry_date > NOW()
                  AND expiry_date <= NOW() + INTERVAL '30 days'
              )::int AS expiring_soon,
              count(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date < NOW())::int AS overdue
            FROM safety_training_records
            WHERE ${orgFilter}
          `),
        );
        const r = (rows[0] as Record<string, unknown>) ?? {};
        return {
          totalRecords: Number(r.total ?? 0),
          certifiedMembers: Number(r.certified ?? 0),
          expiringSoon: Number(r.expiring_soon ?? 0),
          overdue: Number(r.overdue ?? 0),
        };
      });
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety training stats query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return empty;
    }
  },
);
