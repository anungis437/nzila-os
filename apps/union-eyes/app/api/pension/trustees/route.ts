import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrustees } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createTrusteeSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().max(255),
  role: z.string().max(100).optional(),
  appointedDate: z.coerce.date().optional(),
  termEndDate: z.coerce.date().optional(),
  status: z.enum(['active', 'inactive', 'removed']).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List trustees', description: 'List all pension trustees for the organization' },
  },
  async ({ _request, organizationId }) => {
    const trustees = await db
      .select()
      .from(pensionTrustees)
      .where(eq(pensionTrustees.organizationId, organizationId!))
      .orderBy(desc(pensionTrustees.createdAt));
    return trustees;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Add trustee', description: 'Add a new pension trustee' },
  },
  async ({ body, organizationId }) => {
    const parsed = createTrusteeSchema.parse(body);
    const [trustee] = await db
      .insert(pensionTrustees)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return trustee;
  },
);

