/**
 * GET POST /api/v2/governance/policies/rules
 * Governance policy rules backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId }) => {
    const rows = await db
      .select()
      .from(governancePolicies)
      .where(eq(governancePolicies.organizationId, organizationId!))
      .orderBy(desc(governancePolicies.createdAt))
      .limit(50);
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const [row] = await db.insert(governancePolicies).values({ ...(body as Record<string, unknown>), organizationId: organizationId! } as typeof governancePolicies.$inferInsert).returning();
    return { data: row };
  },
);
