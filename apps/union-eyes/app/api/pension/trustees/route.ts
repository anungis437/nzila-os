import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrustees } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List trustees', description: 'List all pension trustees for the organization' },
  },
  async ({ request, organizationId }) => {
    const trustees = await db
      .select()
      .from(pensionTrustees)
      .where(eq(pensionTrustees.organizationId, organizationId!))
      .orderBy(desc(pensionTrustees.createdAt));
    return { data: trustees };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Add trustee', description: 'Add a new pension trustee' },
  },
  async ({ body, organizationId }) => {
    const [trustee] = await db
      .insert(pensionTrustees)
      .values({ ...body, organizationId: organizationId! })
      .returning();
    return { data: trustee };
  },
);

