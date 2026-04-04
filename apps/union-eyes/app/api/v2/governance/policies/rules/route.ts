/**
 * GET POST /api/v2/governance/policies/rules
 * Governance policy rules backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createPolicySchema = z.object({
  title: z.string().min(1).max(1000),
  category: z.enum(['hr', 'finance', 'operations', 'safety', 'governance', 'legal', 'other']).default('hr'),
  description: z.string().max(5000).optional(),
  content: z.string().max(50000).optional(),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
});

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
    return rows;
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const parsed = createPolicySchema.parse(body);
    const [row] = await withRLSContext(async () =>
      db.insert(governancePolicies).values({ ...parsed, organizationId: organizationId! }).returning()
    );
    return row;
  },
);
