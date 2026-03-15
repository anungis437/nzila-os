import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionPlans } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
    return { data: plan ?? null };
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
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId!)))
      .returning();
    return { data: plan ?? null };
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
    return { data: plan ?? null };
  },
);

