/**
 * GET /api/workbench/assigned
 * Returns claims from the database for the LRO workbench case queue.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench'],
      summary: 'GET assigned cases',
      description: 'Returns claims from the database for the LRO case queue.',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    const status = url.searchParams.get('status');

    return withSystemContext(async () => {
      const conditions: ReturnType<typeof sql>[] = [];
      if (organizationId) {
        conditions.push(sql`organization_id = ${organizationId}`);
      }
      if (status) {
        conditions.push(sql`status = ${status}`);
      }

      const where = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const rows = await db.execute(
        sql`SELECT
              claim_id AS "claimId",
              claim_number AS "claimNumber",
              organization_id AS "organizationId",
              member_id AS "memberId",
              is_anonymous AS "isAnonymous",
              claim_type AS "claimType",
              status,
              priority,
              incident_date AS "incidentDate",
              location,
              description,
              desired_outcome AS "desiredOutcome",
              witnesses_present AS "witnessesPresent",
              witness_details AS "witnessDetails",
              previously_reported AS "previouslyReported",
              previous_report_details AS "previousReportDetails",
              assigned_to AS "assignedTo",
              assigned_at AS "assignedAt",
              COALESCE(attachments, '[]'::jsonb) AS attachments,
              COALESCE(voice_transcriptions, '[]'::jsonb) AS "voiceTranscriptions",
              COALESCE(metadata, '{}'::jsonb) AS metadata,
              created_at AS "createdAt",
              updated_at AS "updatedAt",
              closed_at AS "closedAt"
            FROM claims
            ${where}
            ORDER BY
              CASE priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
              END,
              created_at DESC
            LIMIT 200`
      );

      return { claims: rows };
    });
  },
);

