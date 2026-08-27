/**
 * GET /api/health-safety/inspections/findings
 * Recent inspections that recorded any narrative findings or areas of concern.
 * Returns { findings: [{ id, inspectionNumber, workplaceName, completedDate,
 *                        hazardsIdentified, criticalHazards, findings,
 *                        areasOfConcern }] }.
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
      summary: 'Recent inspection findings',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const limitRaw = Number(url.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? Math.floor(limitRaw) : 20;
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    try {
      return await withRLSContext(async () => {
        const rows = Array.from(
          await db.execute(sql`
            SELECT
              id,
              inspection_number AS "inspectionNumber",
              workplace_name AS "workplaceName",
              completed_date AS "completedDate",
              hazards_identified AS "hazardsIdentified",
              critical_hazards AS "criticalHazards",
              findings,
              areas_of_concern AS "areasOfConcern"
            FROM safety_inspections
            WHERE ${orgFilter}
              AND (findings IS NOT NULL OR areas_of_concern IS NOT NULL)
            ORDER BY COALESCE(completed_date, scheduled_date) DESC
            LIMIT ${limit}
          `),
        );
        return { findings: Array.from(rows) };
      });
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Health-safety inspection findings query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return { findings: [] };
    }
  },
);
