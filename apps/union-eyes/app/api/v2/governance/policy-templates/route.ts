/**
 * GET POST /api/v2/governance/policy-templates
 * Policy templates (draft policies) backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPolicyTemplateSchema = z.object({
  title: z.string().min(1).max(500),
  category: z.string().max(50).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  updatedBy: z.string().max(255).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId }) => {
    const rows = await db
      .select()
      .from(governancePolicies)
      .where(
        and(
          eq(governancePolicies.organizationId, organizationId!),
          eq(governancePolicies.status, 'draft'),
        ),
      )
      .orderBy(desc(governancePolicies.createdAt))
      .limit(50);
    return rows;
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const parsed = createPolicyTemplateSchema.parse(body);
    const [row] = await db
      .insert(governancePolicies)
      .values({ ...parsed, organizationId: organizationId!, status: 'draft' })
      .returning();
    return row;
  },
);
