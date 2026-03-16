import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

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
    return { data: plans };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Create pension plan', description: 'Create a new pension plan' },
  },
  async ({ body, organizationId }) => {
    const [plan] = await db
      .insert(pensionPlans)
      .values({ ...(body as Record<string, unknown>), organizationId: organizationId! } as typeof pensionPlans.$inferInsert)
      .returning();
    return { data: plan };
  },
);

