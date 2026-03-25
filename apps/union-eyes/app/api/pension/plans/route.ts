import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPlanSchema = z.object({
  planName: z.string().max(255),
  planType: z.enum(['defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit']).optional(),
  status: z.enum(['active', 'frozen', 'terminated', 'pending_approval']).optional(),
  activeMembers: z.number().int().min(0).optional(),
  totalAssets: z.string().optional(),
  fundingStatus: z.string().optional(),
  description: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List pension plans', description: 'List all pension plans for the organization' },
  },
  async ({ request, organizationId }) => {
    const plans = await db
      .select()
      .from(pensionPlans)
      .where(eq(pensionPlans.organizationId, organizationId!))
      .orderBy(desc(pensionPlans.createdAt));
    return plans;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Create pension plan', description: 'Create a new pension plan' },
  },
  async ({ body, organizationId }) => {
    const parsed = createPlanSchema.parse(body);
    const [plan] = await db
      .insert(pensionPlans)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return plan;
  },
);

