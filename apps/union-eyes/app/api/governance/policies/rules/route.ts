/**
 * GET POST /api/governance/policies/rules
 * Governance policy rules — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
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

    return { data: policies, pagination: { page, limit, total: totalResult[0]?.total ?? 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Create governance policy' },
  },
  async ({ body, organizationId }) => {
    const [policy] = await db.insert(governancePolicies).values({ ...(body as Record<string, unknown>), organizationId: organizationId! } as typeof governancePolicies.$inferInsert).returning();
    return { data: policy };
  },
);

