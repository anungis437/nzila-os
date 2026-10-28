/**
 * GET /api/stewards/[id] — one steward assignment of the caller's organization.
 *
 * Same audience split as the collection: a member reads the member-safe projection of an active assignment, an officer
 * reads the full row (audited). Another organization's assignment, or a non-active one for a member, reads as not found.
 */
import { and, eq } from 'drizzle-orm';
import { stewardAssignments } from '@/db/schema';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { toMemberDirectoryEntry } from '@/lib/stewards/steward-directory';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Organization'], summary: 'Get one steward assignment' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params?.id;
    if (!z.guid().safeParse(id).success) throw ApiError.badRequest('id must be a valid identifier');
    const privileged = await hasMinRole('officer');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(stewardAssignments)
        .where(and(eq(stewardAssignments.id, id as string), eq(stewardAssignments.organizationId, organizationId)))
        .limit(1);
      if (!row || (!privileged && row.status !== 'active')) throw ApiError.notFound('Steward assignment not found');

      if (privileged) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'stewards.assignment.read_private',
          resourceType: 'steward_assignments',
          resourceId: row.id,
          details: {},
        });
        return { data: row, view: 'officer' as const };
      }
      return { data: toMemberDirectoryEntry(row), view: 'member' as const };
    });
  },
);
