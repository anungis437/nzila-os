import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionT4aRecords } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List T4A records', description: 'List all T4A tax records for the organization' },
  },
  async ({ request, organizationId }) => {
    const records = await db
      .select()
      .from(pensionT4aRecords)
      .where(eq(pensionT4aRecords.organizationId, organizationId!))
      .orderBy(desc(pensionT4aRecords.createdAt));
    return { data: records };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Generate T4A record', description: 'Generate a new T4A tax record' },
  },
  async ({ body, organizationId }) => {
    const [record] = await db
      .insert(pensionT4aRecords)
      .values({ ...body, organizationId: organizationId! })
      .returning();
    return { data: record };
  },
);
