import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionBenefitClaims } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createBenefitClaimSchema = z.object({
  memberId: z.string().uuid(),
  memberName: z.string().max(255),
  claimType: z.string().max(100),
  amount: z.string(),
  status: z.enum(['pending', 'under_review', 'approved', 'denied', 'paid']).optional(),
  submittedDate: z.coerce.date().optional(),
  processedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List benefit claims', description: 'List all pension benefit claims for the organization' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    const rows = await db
      .select()
      .from(pensionBenefitClaims)
      .where(
        memberId
          ? and(
              eq(pensionBenefitClaims.organizationId, organizationId!),
              eq(pensionBenefitClaims.memberId, memberId),
            )
          : eq(pensionBenefitClaims.organizationId, organizationId!),
      )
      .orderBy(desc(pensionBenefitClaims.createdAt));
    return rows;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Submit benefit claim', description: 'Submit a new pension benefit claim' },
  },
  async ({ body, organizationId }) => {
    const parsed = createBenefitClaimSchema.parse(body);
    const [claim] = await db
      .insert(pensionBenefitClaims)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return claim;
  },
);

