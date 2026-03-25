/**
 * GET POST /api/governance/policies/rules
 * Governance policy rules — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
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
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'List governance policies' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [totalResult, policies] = await Promise.all([
      db.select({ total: count() }).from(governancePolicies).where(eq(governancePolicies.organizationId, organizationId!)),
      db.select().from(governancePolicies).where(eq(governancePolicies.organizationId, organizationId!)).orderBy(desc(governancePolicies.createdAt)).limit(limit).offset(offset),
    ]);

    return policies;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Create governance policy' },
  },
  async ({ body, organizationId }) => {
    const parsed = createPolicySchema.parse(body);
    const [policy] = await db.insert(governancePolicies).values({ ...parsed, organizationId: organizationId! }).returning();
    return policy;
  },
);

