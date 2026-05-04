/**
 * GET /api/admin/ai-usage
 * List AI invocation audit log entries.
 * Admin-only view of all AI route calls, their model, dataClass, and audit ref IDs.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';
import { standardSuccessResponse } from '@/lib/api/standardized-responses';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Admin'],
      summary: 'List AI invocation audit log entries',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    return withSystemContext(async () => {
      const rows = await db.execute(sql`
        SELECT
          audit_id   AS id,
          user_id    AS "userId",
          organization_id AS "organizationId",
          resource_id     AS "origin",
          created_at      AS "timestamp",
          metadata->>'model'       AS model,
          metadata->>'dataClass'   AS "dataClass",
          metadata->>'auditRefId'  AS "auditRefId"
        FROM audit_security.audit_logs
        WHERE metadata->>'eventType' = 'ai.invocation'
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM audit_security.audit_logs
        WHERE metadata->>'eventType' = 'ai.invocation'
      `);

      const total = (countResult as Record<string, unknown>[])[0]?.total ?? 0;

      return standardSuccessResponse(
        { entries: rows as Record<string, unknown>[], total, page, limit },
      );
    });
  },
);
