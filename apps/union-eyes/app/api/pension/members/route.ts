import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionMembers } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createMemberSchema = z.object({
  planId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  name: z.string().max(255),
  planName: z.string().max(255),
  enrollmentDate: z.coerce.date().optional(),
  membershipStatus: z.enum(['active', 'inactive', 'retired', 'deferred', 'terminated']).optional(),
  yearsOfService: z.string().optional(),
  vestingStatus: z.enum(['not_vested', 'partially_vested', 'fully_vested']).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List pension members', description: 'List pension members by organization and optionally by plan' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const planId = url.searchParams.get('planId');

    const conditions = [eq(pensionMembers.organizationId, organizationId!)];
    if (planId) conditions.push(eq(pensionMembers.planId, planId));

    const members = await db
      .select()
      .from(pensionMembers)
      .where(and(...conditions))
      .orderBy(desc(pensionMembers.createdAt));
    return members;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Enroll pension member', description: 'Enroll a new member in a pension plan' },
  },
  async ({ body, organizationId }) => {
    const parsed = createMemberSchema.parse(body);
    const [member] = await db
      .insert(pensionMembers)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return member;
  },
);

