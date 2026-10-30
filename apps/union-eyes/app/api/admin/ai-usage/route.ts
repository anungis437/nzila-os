/**
 * GET /api/admin/ai-usage
 * List AI invocation audit log entries.
 * Admin-only view of all AI route calls, their model, dataClass, and audit ref IDs.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { withOrgOwnedContext } from '@/lib/db/org-owned-context';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { sql } from 'drizzle-orm';
import { standardSuccessResponse } from '@/lib/api/standardized-responses';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    requireOrg: true,
    rlsOrgContext: true,
    openapi: {
      tags: ['Admin'],
      summary: 'List AI invocation audit log entries',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required for AI audit visibility');
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const v2 = currentStateContextEnabled();
    return withOrgOwnedContext(async () => {
      // Both canonical and legacy paths require an explicit authenticated-tenant
      // predicate. Legacy audit_security is NOT implicitly tenant-scoped.
      const rows = v2
        ? await db.execute(sql`
        SELECT
          audit_id   AS id,
          user_id    AS "userId",
          organization_id AS "organizationId",
          resource_id     AS "origin",
          created_at      AS "timestamp",
          details->'metadata'->>'model'       AS model,
          details->'metadata'->>'dataClass'   AS "dataClass",
          details->'metadata'->>'auditRefId'  AS "auditRefId"
        FROM public.audit_logs
        WHERE details->>'eventType' = 'ai.invocation'
          AND organization_id = ${organizationId}::uuid
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)
        : await db.execute(sql`
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
          AND organization_id = ${organizationId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const countResult = v2
        ? await db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM public.audit_logs
        WHERE details->>'eventType' = 'ai.invocation'
          AND organization_id = ${organizationId}::uuid
      `)
        : await db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM audit_security.audit_logs
        WHERE metadata->>'eventType' = 'ai.invocation'
          AND organization_id = ${organizationId}
      `);

      const total = (countResult as Record<string, unknown>[])[0]?.total ?? 0;

      return standardSuccessResponse(
        { entries: rows as Record<string, unknown>[], total, page, limit },
      );
    });
  },
);
