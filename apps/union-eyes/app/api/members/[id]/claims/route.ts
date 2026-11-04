/**
 * Member claims list route
 * GET /api/members/[id]/claims — list claims filed by or assigned to a member
 *
 * [id] is the membership row the directory lists (organization_members.id), but a claim names its member by user id, so the membership is
 * resolved first. Which claims the caller may list is the case kernel's decision (caseReadScope), as for /api/cases: the route never lists
 * a case the caller could not open, and it sends the list columns only, not the description, analysis or amounts.
 */
import { withApi } from '@/lib/api/framework';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { organizationMembers } from '@/db/schema-organizations';
import { and, eq, or, desc, isNull } from 'drizzle-orm';
import { caseReadScope, getCaseActor } from '@/lib/cases/case-authorization';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members', 'Claims'],
      summary: 'List claims for a member',
      description: 'Returns claims filed by or assigned to a specific member, limited to the cases the caller may read.',
    },
  },
  async ({ params }) => {
    // A reference that cannot be a membership id is a member that does not exist, not a database error.
    if (!UUID.test(params.id)) throw ApiError.notFound('Member');
    const actor = await getCaseActor();

    const [member] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, params.id),
          eq(organizationMembers.organizationId, actor.organizationId),
          isNull(organizationMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!member) throw ApiError.notFound('Member');

    return db
      .select({
        id: claims.id,
        claimId: claims.claimId,
        claimNumber: claims.claimNumber,
        claimType: claims.claimType,
        status: claims.status,
        priority: claims.priority,
        createdAt: claims.createdAt,
        updatedAt: claims.updatedAt,
      })
      .from(claims)
      .where(and(caseReadScope(actor), or(eq(claims.memberId, member.userId), eq(claims.assignedTo, member.userId))))
      .orderBy(desc(claims.createdAt), desc(claims.id));
  }
);
