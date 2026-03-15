import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionBenefitClaims } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List benefit claims', description: 'List all pension benefit claims for the organization' },
  },
  async ({ _request, organizationId }) => {
    const claims = await db
      .select()
      .from(pensionBenefitClaims)
      .where(eq(pensionBenefitClaims.organizationId, organizationId!))
      .orderBy(desc(pensionBenefitClaims.createdAt));
    return { data: claims };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Submit benefit claim', description: 'Submit a new pension benefit claim' },
  },
  async ({ body, organizationId }) => {
    const [claim] = await db
      .insert(pensionBenefitClaims)
      .values({ ...body, organizationId: organizationId! })
      .returning();
    return { data: claim };
  },
);

