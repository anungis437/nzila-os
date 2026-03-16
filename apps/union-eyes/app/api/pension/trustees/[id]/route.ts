import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrustees } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Get trustee', description: 'Get a single trustee by ID' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [trustee] = await db
      .select()
      .from(pensionTrustees)
      .where(and(eq(pensionTrustees.id, id), eq(pensionTrustees.organizationId, organizationId!)));
    return { data: trustee ?? null };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Update trustee', description: 'Update an existing trustee' },
  },
  async ({ params, body, organizationId }) => {
    const id = params.id;
    const [trustee] = await db
      .update(pensionTrustees)
      .set({ ...(body as Record<string, unknown>), updatedAt: new Date() })
      .where(and(eq(pensionTrustees.id, id), eq(pensionTrustees.organizationId, organizationId!)))
      .returning();
    return { data: trustee ?? null };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Delete trustee', description: 'Delete a trustee' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [trustee] = await db
      .delete(pensionTrustees)
      .where(and(eq(pensionTrustees.id, id), eq(pensionTrustees.organizationId, organizationId!)))
      .returning();
    return { data: trustee ?? null };
  },
);

