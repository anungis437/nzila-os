/**
 * Member claims list route
 * GET /api/members/[id]/claims — list claims filed by or assigned to a member
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { eq, or, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members', 'Claims'],
      summary: 'List claims for a member',
      description: 'Returns claims filed by or assigned to a specific member.',
    },
  },
  async ({ params }) => {
    const memberId = params.id;

    const memberClaims = await db
      .select()
      .from(claims)
      .where(or(eq(claims.memberId, memberId), eq(claims.assignedTo, memberId)))
      .orderBy(desc(claims.createdAt));

    return memberClaims;
  }
);
