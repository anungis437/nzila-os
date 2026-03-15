/**
 * GET POST /api/governance/policy-templates
 * Governance policy templates — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'List policy templates' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const where = and(eq(governancePolicies.organizationId, organizationId!), eq(governancePolicies.status, 'draft'));

    const [totalResult, templates] = await Promise.all([
      db.select({ total: count() }).from(governancePolicies).where(where),
      db.select().from(governancePolicies).where(where).orderBy(desc(governancePolicies.createdAt)).limit(limit).offset(offset),
    ]);

    return { data: templates, pagination: { page, limit, total: totalResult[0]?.total ?? 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Create policy template' },
  },
  async ({ body, organizationId }) => {
    const [template] = await db.insert(governancePolicies).values({ ...body, organizationId: organizationId!, status: 'draft' }).returning();
    return { data: template };
  },
);

