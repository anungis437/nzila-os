/**
 * GET /api/workbench/assigned
 * Returns claims from the database for the LRO workbench case queue.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor, caseReadScope } from '@/lib/cases/case-authorization';
import { projectWorkbenchRow, workbenchCapabilities } from '@/lib/cases/workbench-projection';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench'],
      summary: 'GET assigned cases',
      description:
        'Returns the actor-scoped case queue. Organization and role are derived server-side; ' +
        'matters without case-resource authority are reduced to triage metadata.',
    },
  },
  async ({ request }) => {
    const actor = await getCaseActor();
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get('organizationId');
    const status = url.searchParams.get('status');

    // The query string is a hint, never authority.
    if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
      throw ApiError.forbidden('Organization scope is not permitted for this actor.');
    }

    const conditions: ReturnType<typeof sql>[] = [caseReadScope(actor, 'c')];
    if (status) {
      conditions.push(sql`c.status = ${status}`);
    }

    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    const rows = await withRLSContext(async (tx) => tx.execute(
      sql`SELECT
            c.claim_id AS "claimId",
            c.claim_number AS "claimNumber",
            c.organization_id AS "organizationId",
            c.member_id AS "memberId",
            c.is_anonymous AS "isAnonymous",
            c.claim_type AS "claimType",
            c.status,
            c.priority,
            c.incident_date AS "incidentDate",
            c.location,
            c.description,
            c.desired_outcome AS "desiredOutcome",
            c.witnesses_present AS "witnessesPresent",
            c.witness_details AS "witnessDetails",
            c.previously_reported AS "previouslyReported",
            c.previous_report_details AS "previousReportDetails",
            c.assigned_to AS "assignedTo",
            c.assigned_at AS "assignedAt",
            COALESCE(c.attachments, '[]'::jsonb) AS attachments,
            COALESCE(c.voice_transcriptions, '[]'::jsonb) AS "voiceTranscriptions",
            COALESCE(c.metadata, '{}'::jsonb) AS metadata,
            c.created_at AS "createdAt",
            c.updated_at AS "updatedAt",
            c.closed_at AS "closedAt",
            m.name AS "memberName",
            m.email AS "memberEmail",
            m.phone AS "memberPhone"
          FROM claims c
          LEFT JOIN organization_members m
            ON m.user_id = c.member_id
            AND m.organization_id::text = c.organization_id::text
          ${where}
          ORDER BY
            CASE c.priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            c.created_at DESC
          LIMIT 200`
    ));

    return {
      claims: Array.from(rows as Iterable<Record<string, unknown>>).map((row) => projectWorkbenchRow(actor, row)),
      capabilities: workbenchCapabilities(actor),
    };
  },
);

