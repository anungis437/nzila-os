/**
 * GET /api/activities
 * List recent audit-log entries for the current organization.
 * Uses raw SQL because the Drizzle schema targets audit_security schema
 * while the staging DB stores audit_logs in the public schema.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['System'],
      summary: 'List recent activity / audit log entries',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    return withSystemContext(async () => {
      // Table lives in audit_security schema; PK is audit_id, metadata holds details
      const rows = await db.execute(sql`
        SELECT audit_id AS id, user_id, organization_id, action,
               resource_type, resource_id, metadata AS details, created_at
        FROM audit_security.audit_logs
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Transform raw audit rows into the shape the dashboard component expects
      const activities = (rows as Record<string, unknown>[]).map((row) => {
        const action = String(row.action ?? '');
        const resourceType = String(row.resource_type ?? '');
        const details = (row.details ?? {}) as Record<string, unknown>;

        // Derive a human-readable description
        const actionLabels: Record<string, string> = {
          create: 'Created',
          update: 'Updated',
          delete: 'Deleted',
          status_change: 'Changed status of',
          assign: 'Assigned',
          resolve: 'Resolved',
          close: 'Closed',
          login: 'Logged in',
          export: 'Exported',
        };
        const verb = actionLabels[action] ?? action.replace(/_/g, ' ');
        const noun = resourceType.replace(/_/g, ' ');
        const description = details.description
          ? String(details.description)
          : `${verb} ${noun}`.trim();

        // Derive color from action
        const colorMap: Record<string, string> = {
          create: 'green',
          resolve: 'green',
          close: 'green',
          delete: 'red',
          update: 'blue',
          status_change: 'orange',
          assign: 'purple',
        };
        const color = colorMap[action] ?? 'blue';

        // Derive icon from resource type
        const iconMap: Record<string, string> = {
          claim: 'file',
          grievance: 'file',
          member: 'users',
          organization_member: 'users',
          deadline: 'clock',
        };
        const icon = iconMap[resourceType] ?? 'file';

        return {
          id: row.id,
          description,
          color,
          icon,
          claimNumber: details.claimNumber ?? null,
          createdAt: row.created_at,
        };
      });

      return activities;
    });
  },
);
