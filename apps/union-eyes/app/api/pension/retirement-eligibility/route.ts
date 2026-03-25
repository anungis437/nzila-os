import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionMembers } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Check retirement eligibility', description: 'List members meeting the years-of-service threshold for retirement eligibility' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const threshold = parseInt(url.searchParams.get('threshold') ?? '25', 10);

    const eligible = await db
      .select()
      .from(pensionMembers)
      .where(
        and(
          eq(pensionMembers.organizationId, organizationId!),
          gte(pensionMembers.yearsOfService, String(threshold)),
        ),
      )
      .orderBy(desc(pensionMembers.createdAt));
    return eligible;
  },
);

