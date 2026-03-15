import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrusteeMeetings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List trustee meetings', description: 'List all trustee meetings for the organization' },
  },
  async ({ request, organizationId }) => {
    const meetings = await db
      .select()
      .from(pensionTrusteeMeetings)
      .where(eq(pensionTrusteeMeetings.organizationId, organizationId!))
      .orderBy(desc(pensionTrusteeMeetings.createdAt));
    return { data: meetings };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Create trustee meeting', description: 'Schedule a new trustee meeting' },
  },
  async ({ body, organizationId }) => {
    const [meeting] = await db
      .insert(pensionTrusteeMeetings)
      .values({ ...body, organizationId: organizationId! })
      .returning();
    return { data: meeting };
  },
);

