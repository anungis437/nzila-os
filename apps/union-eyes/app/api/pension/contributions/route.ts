import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionContributions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List contributions', description: 'List all pension contributions for the organization' },
  },
  async ({ request, organizationId }) => {
    const contributions = await db
      .select()
      .from(pensionContributions)
      .where(eq(pensionContributions.organizationId, organizationId!))
      .orderBy(desc(pensionContributions.createdAt));
    return { data: contributions };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Record contribution', description: 'Record a new pension contribution' },
  },
  async ({ body, organizationId }) => {
    const [contribution] = await db
      .insert(pensionContributions)
      .values({ ...body, organizationId: organizationId! })
      .returning();
    return { data: contribution };
  },
);
