import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updatePlanSchema = z.object({
  planName: z.string().max(255).optional(),
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
    openapi: { tags: ['Pension'], summary: 'Get pension plan', description: 'Get a single pension plan by ID' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [plan] = await db
      .select()
      .from(pensionPlans)
      .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId!)));
    return plan ?? null;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Update pension plan', description: 'Update an existing pension plan' },
  },
  async ({ params, body, organizationId }) => {
    const id = params.id;
    const [plan] = await db
      .update(pensionPlans)
      .set({ ...updatePlanSchema.parse(body), updatedAt: new Date() })
      .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId!)))
      .returning();
    return plan ?? null;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Delete pension plan', description: 'Delete a pension plan' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [plan] = await db
      .delete(pensionPlans)
      .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId!)))
      .returning();
    return plan ?? null;
  },
);

