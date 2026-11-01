/**
 * GET POST /api/reports/templates — the report templates of the caller's organization.
 *
 * This path was the generic factory over every report definition, so it listed all of them to any member and stored a
 * new report as a non-template by default. It now lists only rows marked as templates, at the steward floor, and a
 * create is always stored as a template of the caller's organization. The create fields are an allow-list; the
 * organization, creator, template flag and run counters are never taken from the body.
 */
import { and, desc, eq } from 'drizzle-orm';
import { reports } from '@/db/schema';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 200;

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  config: z.record(z.string(), z.unknown()),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Analytics'], summary: 'List report templates' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const rows = await tx
        .select({
          id: reports.id,
          name: reports.name,
          description: reports.description,
          reportType: reports.reportType,
          category: reports.category,
          createdAt: reports.createdAt,
        })
        .from(reports)
        .where(and(eq(reports.organizationId, organizationId), eq(reports.isTemplate, true)))
        .orderBy(desc(reports.createdAt))
        .limit(MAX_ROWS);
      return { data: rows, limit: MAX_ROWS };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Analytics'], summary: 'Create a report template' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw ApiError.badRequest('A name and a config object are required, and no other field is accepted');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [row] = await tx
        .insert(reports)
        .values({
          organizationId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          config: parsed.data.config,
          isTemplate: true,
          isPublic: false,
          createdBy: userId,
        })
        .returning({ id: reports.id, name: reports.name, createdAt: reports.createdAt });
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'report.template.create',
        resourceType: 'reports',
        resourceId: row.id,
        details: { name: row.name },
      });
      return { data: row };
    });
  },
);
