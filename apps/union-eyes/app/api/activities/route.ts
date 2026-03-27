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
               resource_type, metadata AS details, created_at
        FROM audit_security.audit_logs
        WHERE organization_id = ${organizationId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT count(*)::int AS total
        FROM audit_security.audit_logs
        WHERE organization_id = ${organizationId}
      `);

      const total = Number((countResult[0] as Record<string, unknown>)?.total ?? 0);

      return rows;
    });
  },
);
