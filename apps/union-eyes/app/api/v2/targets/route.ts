/**
 * GET POST /api/v2/targets
 * KPI target management — list and create performance targets.
 * Backed by kpiConfigurations table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { kpiConfigurations } from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — list targets with filtering & pagination
// ---------------------------------------------------------------------------
export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Targets'],
      summary: 'List KPI targets',
      description: 'Returns paginated KPI targets for the authenticated organization.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const isActive = url.searchParams.get('isActive');
    const dataSource = url.searchParams.get('dataSource');
    const offset = (page - 1) * limit;

    const conditions = [eq(kpiConfigurations.organizationId, organizationId!)];
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      conditions.push(eq(kpiConfigurations.isActive, isActive === 'true'));
    }
    if (dataSource) {
      conditions.push(eq(kpiConfigurations.dataSource, dataSource));
    }

    const whereClause = and(...conditions);

    const [totalResult, targets] = await Promise.all([
      db.select({ total: count() }).from(kpiConfigurations).where(whereClause),
      db
        .select()
        .from(kpiConfigurations)
        .where(whereClause)
        .orderBy(desc(kpiConfigurations.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      targets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
);

// ---------------------------------------------------------------------------
// POST — create a new target
// ---------------------------------------------------------------------------
const createTargetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  metricType: z.string().min(1),
  dataSource: z.enum(['claims', 'members', 'financial', 'custom_query']),
  calculation: z.record(z.unknown()),
  visualizationType: z.enum(['line', 'bar', 'pie', 'gauge', 'number']),
  targetValue: z.number().optional(),
  warningThreshold: z.number().optional(),
  criticalThreshold: z.number().optional(),
  alertEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string()).optional(),
  refreshInterval: z.number().int().min(60).max(86400).optional(),
  displayOrder: z.number().int().optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: createTargetSchema,
    openapi: {
      tags: ['Targets'],
      summary: 'Create KPI target',
      description: 'Creates a new KPI target for the organization.',
    },
  },
  async ({ body, organizationId, userId }) => {
    const [target] = await db
      .insert(kpiConfigurations)
      .values({
        organizationId: organizationId!,
        createdBy: userId!,
        name: body.name,
        description: body.description ?? null,
        metricType: body.metricType,
        dataSource: body.dataSource,
        calculation: body.calculation,
        visualizationType: body.visualizationType,
        targetValue: body.targetValue?.toString() ?? null,
        warningThreshold: body.warningThreshold?.toString() ?? null,
        criticalThreshold: body.criticalThreshold?.toString() ?? null,
        alertEnabled: body.alertEnabled ?? false,
        alertRecipients: body.alertRecipients ?? null,
        refreshInterval: body.refreshInterval ?? 3600,
        displayOrder: body.displayOrder ?? 0,
        isActive: true,
      })
      .returning();

    return { target };
  },
);
