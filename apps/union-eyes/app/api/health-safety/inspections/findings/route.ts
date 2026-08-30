/**
 * GET /api/health-safety/inspections/findings
 * Recent completed inspection findings for the InspectionFindingsCard UI.
 * Returns { findings: InspectionFinding[] }.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

type FindingStatus = 'completed' | 'pending_review' | 'approved';

export function mapStatus(status: string): FindingStatus {
  if (status === 'requires_followup') return 'pending_review';
  if (status === 'followup_complete') return 'approved';
  return 'completed';
}

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
    const orgFilter = organizationId ? sql`organization_id = ${organizationId}` : sql`1=1`;

    const rows = Array.from(
      await withRLSContext(async () =>
        db.execute(sql`
          SELECT
            id,
            inspection_number,
            inspection_scope,
            checklist_used,
            coalesce(completed_date, scheduled_date) AS finding_date,
            coalesce(workplace_name, specific_location) AS location,
            lead_inspector_name,
            score_percentage,
            items_passed,
            items_failed,
            total_items_checked,
            critical_hazards,
            status
          FROM safety_inspections
          WHERE ${orgFilter}
            AND status IN ('completed', 'requires_followup', 'followup_complete')
          ORDER BY coalesce(completed_date, scheduled_date) DESC
          LIMIT 20
        `)
      )
    );

    const findings = rows.map((r) => {
      const row = r as Record<string, unknown>;
      const passCount = Number(row.items_passed ?? 0);
      const failCount = Number(row.items_failed ?? 0);
      const totalChecked = Number(row.total_items_checked ?? 0);
      const naCount = Math.max(totalChecked - passCount - failCount, 0);

      return {
        id: String(row.id),
        title: (row.inspection_scope as string) || (row.checklist_used as string) || `Inspection ${row.inspection_number}`,
        date: row.finding_date,
        location: (row.location as string) || '',
        inspector: (row.lead_inspector_name as string) || '',
        complianceRate: row.score_percentage != null ? Number(row.score_percentage) : 0,
        passCount,
        failCount,
        naCount,
        criticalIssues: Number(row.critical_hazards ?? 0),
        status: mapStatus(String(row.status)),
      };
    });

    return { findings };
  },
);
