/**
 * GET /api/v2/health-safety/inspections/findings
 * Returns inspection findings/checklist items for the inspections page.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Health-safety'], summary: 'Inspection findings' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    return withRLSContext(async (db) => {
      const rows = Array.from(
        await db.execute(sql`
          SELECT id, inspection_number, inspection_type, status, workplace_name,
                 findings, areas_of_concern, recommendations, score_percentage,
                 hazards_identified, critical_hazards, completed_date, created_at
          FROM safety_inspections
          WHERE ${orgFilter} AND (findings IS NOT NULL OR areas_of_concern IS NOT NULL)
          ORDER BY created_at DESC
          LIMIT 50
        `)
      );

      return { findings: rows.map((r) => r as Record<string, unknown>) };
    });
  },
);
