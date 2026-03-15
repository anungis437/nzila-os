/**
 * GET PATCH DELETE /api/v2/targets/[id]
 * Single-target CRUD operations.
 * Backed by kpiConfigurations table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { kpiConfigurations, analyticsMetrics } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — single target with recent metric history
// ---------------------------------------------------------------------------
export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Targets'],
      summary: 'Get KPI target by ID',
      description: 'Returns a single KPI target with its recent metric data.',
    },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/targets/')[1]?.split('?')[0];
    if (!id) throw ApiError.badRequest('Missing target ID');

    const [target] = await db
      .select()
      .from(kpiConfigurations)
      .where(
        and(
          eq(kpiConfigurations.id, id),
          eq(kpiConfigurations.organizationId, organizationId!),
        ),
      );

    if (!target) throw ApiError.notFound('Target not found');

    // Fetch recent metric history for this KPI type
    const history = await db
      .select()
      .from(analyticsMetrics)
      .where(
        and(
          eq(analyticsMetrics.organizationId, organizationId!),
          eq(analyticsMetrics.metricType, target.metricType),
        ),
      )
      .orderBy(desc(analyticsMetrics.periodStart))
      .limit(30);

    return { target, history };
  },
);

// ---------------------------------------------------------------------------
// PATCH — update a target
// ---------------------------------------------------------------------------
const updateTargetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  metricType: z.string().min(1).optional(),
  dataSource: z.enum(['claims', 'members', 'financial', 'custom_query']).optional(),
  calculation: z.record(z.unknown()).optional(),
  visualizationType: z.enum(['line', 'bar', 'pie', 'gauge', 'number']).optional(),
  targetValue: z.number().nullable().optional(),
  warningThreshold: z.number().nullable().optional(),
  criticalThreshold: z.number().nullable().optional(),
  alertEnabled: z.boolean().optional(),
  alertRecipients: z.array(z.string()).optional(),
  refreshInterval: z.number().int().min(60).max(86400).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: updateTargetSchema,
    openapi: {
      tags: ['Targets'],
      summary: 'Update KPI target',
      description: 'Updates an existing KPI target.',
    },
  },
  async ({ request, body, organizationId }) => {
    const id = request.url.split('/targets/')[1]?.split('?')[0];
    if (!id) throw ApiError.badRequest('Missing target ID');

    // Build update payload — only include fields that were provided
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.metricType !== undefined) updates.metricType = body.metricType;
    if (body.dataSource !== undefined) updates.dataSource = body.dataSource;
    if (body.calculation !== undefined) updates.calculation = body.calculation;
    if (body.visualizationType !== undefined) updates.visualizationType = body.visualizationType;
    if (body.targetValue !== undefined) updates.targetValue = body.targetValue?.toString() ?? null;
    if (body.warningThreshold !== undefined) updates.warningThreshold = body.warningThreshold?.toString() ?? null;
    if (body.criticalThreshold !== undefined) updates.criticalThreshold = body.criticalThreshold?.toString() ?? null;
    if (body.alertEnabled !== undefined) updates.alertEnabled = body.alertEnabled;
    if (body.alertRecipients !== undefined) updates.alertRecipients = body.alertRecipients;
    if (body.refreshInterval !== undefined) updates.refreshInterval = body.refreshInterval;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.displayOrder !== undefined) updates.displayOrder = body.displayOrder;

    const [target] = await db
      .update(kpiConfigurations)
      .set(updates)
      .where(
        and(
          eq(kpiConfigurations.id, id),
          eq(kpiConfigurations.organizationId, organizationId!),
        ),
      )
      .returning();

    if (!target) throw ApiError.notFound('Target not found');

    return { target };
  },
);

// ---------------------------------------------------------------------------
// DELETE — soft-delete (deactivate) a target
// ---------------------------------------------------------------------------
export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Targets'],
      summary: 'Delete KPI target',
      description: 'Soft-deletes (deactivates) a KPI target.',
    },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/targets/')[1]?.split('?')[0];
    if (!id) throw ApiError.badRequest('Missing target ID');

    const [target] = await db
      .update(kpiConfigurations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(kpiConfigurations.id, id),
          eq(kpiConfigurations.organizationId, organizationId!),
        ),
      )
      .returning();

    if (!target) throw ApiError.notFound('Target not found');

    return { target };
  },
);
