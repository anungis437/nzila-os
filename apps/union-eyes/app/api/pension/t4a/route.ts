import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionT4aRecords } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createT4aSchema = z.object({
  memberId: z.string().uuid(),
  memberName: z.string().max(255),
  taxYear: z.number().int().min(1900).max(2100),
  pensionIncome: z.string(),
  status: z.enum(['draft', 'generated', 'filed', 'amended']).optional(),
  generatedDate: z.coerce.date().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List T4A records', description: 'List all T4A tax records for the organization' },
  },
  async ({ _request, organizationId }) => {
    const records = await db
      .select()
      .from(pensionT4aRecords)
      .where(eq(pensionT4aRecords.organizationId, organizationId!))
      .orderBy(desc(pensionT4aRecords.createdAt));
    return records;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Generate T4A record', description: 'Generate a new T4A tax record' },
  },
  async ({ body, organizationId }) => {
    const parsed = createT4aSchema.parse(body);
    const [record] = await db
      .insert(pensionT4aRecords)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return record;
  },
);
