/**
 * GET POST /api/v2/governance/policy-templates
 * Policy templates (draft policies) backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const [row] = await db
      .insert(governancePolicies)
      .values({ ...body, organizationId: organizationId!, status: 'draft' })
      .returning();
    return { data: row };
  },
);
