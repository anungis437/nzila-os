/**
 * GET /api/stewards — the steward directory of the caller's organization.
 *
 * Members receive a member-safe projection of active assignments (coverage, tenure and the published work contact).
 * Officers receive the full assignment rows, including personal phone, notes and the grievance link, and the read of
 * that private detail is audited. Assignments are not written through this route: the appointing office owns them,
 * and no appointment route exists yet, so a write answers 405 rather than a generic table write.
 */
import { and, asc, eq } from 'drizzle-orm';
import { stewardAssignments } from '@/db/schema';
import { withApi, ApiError } from '@/lib/api/framework';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { toMemberDirectoryEntry } from '@/lib/stewards/steward-directory';

export const dynamic = 'force-dynamic';

const MAX_PAGE_SIZE = 100;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Organization'], summary: 'List the steward directory' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const url = new URL(request.url);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const privileged = await hasMinRole('officer');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const scope = privileged
        ? eq(stewardAssignments.organizationId, organizationId)
        : and(eq(stewardAssignments.organizationId, organizationId), eq(stewardAssignments.status, 'active'));
      const rows = await tx
        .select()
        .from(stewardAssignments)
        .where(scope)
        .orderBy(asc(stewardAssignments.createdAt), asc(stewardAssignments.id))
        .limit(limit)
        .offset((page - 1) * limit);

      if (privileged) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'stewards.directory.read_private',
          resourceType: 'steward_assignments',
          resourceId: organizationId,
          details: { rows: rows.length, page, limit },
        });
        return { data: rows, page, limit, view: 'officer' as const };
      }
      return { data: rows.map(toMemberDirectoryEntry), page, limit, view: 'member' as const };
    });
  },
);
