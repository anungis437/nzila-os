import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionContributions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createContributionSchema = z.object({
  memberId: z.string().uuid(),
  memberName: z.string().max(255),
  period: z.string().max(20),
  amount: z.string(),
  paymentStatus: z.enum(['pending', 'received', 'overdue', 'partial']).optional(),
  paymentDate: z.coerce.date().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List contributions', description: 'List all pension contributions for the organization' },
  },
  async ({ _request, organizationId }) => {
    const contributions = await db
      .select()
      .from(pensionContributions)
      .where(eq(pensionContributions.organizationId, organizationId!))
      .orderBy(desc(pensionContributions.createdAt));
    return contributions;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Record contribution', description: 'Record a new pension contribution' },
  },
  async ({ body, organizationId }) => {
    const parsed = createContributionSchema.parse(body);
    const [contribution] = await db
      .insert(pensionContributions)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return contribution;
  },
);
