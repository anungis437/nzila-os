/**
 * GET POST /api/governance/policy-templates
 * Governance policy templates — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { governancePolicies } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';
import { auditDataMutation } from '@/lib/audit-logger';

const createPolicyTemplateSchema = z.object({
  title: z.string().min(1).max(1000),
  category: z.enum(['hr', 'finance', 'operations', 'safety', 'governance', 'legal', 'other']).default('hr'),
  description: z.string().max(5000).optional(),
  content: z.string().max(50000).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'List policy templates' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const where = and(eq(governancePolicies.organizationId, organizationId!), eq(governancePolicies.status, 'draft'));

    const [_totalResult, templates] = await Promise.all([
      db.select({ total: count() }).from(governancePolicies).where(where),
      db.select().from(governancePolicies).where(where).orderBy(desc(governancePolicies.createdAt)).limit(limit).offset(offset),
    ]);

    return templates;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Create policy template' },
  },
  async ({ body, organizationId, userId }) => {
    const parsed = createPolicyTemplateSchema.parse(body);
    const [template] = await withRLSContext(async () =>
      db.insert(governancePolicies).values({ ...parsed, organizationId: organizationId!, status: 'draft' }).returning()
    );
    await auditDataMutation({
      userId: userId!,
      organizationId: organizationId!,
      resource: 'governance_policies',
      resourceId: template.id,
      action: 'create',
      details: { title: parsed.title, category: parsed.category },
    });
    return template;
  },
);

