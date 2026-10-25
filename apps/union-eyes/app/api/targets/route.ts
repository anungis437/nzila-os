import { kpiConfigurations } from '@/db/schema';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'officer' },
    body: z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      metricType: z.string().min(1).max(100),
      dataSource: z.enum(['claims', 'members', 'financial', 'custom_query']),
      calculation: z.record(z.unknown()).default({ aggregation: 'sum' }),
      visualizationType: z.enum(['line', 'bar', 'pie', 'gauge', 'number']).default('gauge'),
      targetValue: z.number().optional(),
      warningThreshold: z.number().optional(),
      criticalThreshold: z.number().optional(),
      alertEnabled: z.boolean().default(false),
    }),
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .insert(kpiConfigurations)
        .values({
          organizationId,
          createdBy: userId,
          name: body.name,
          description: body.description ?? null,
          metricType: body.metricType,
          dataSource: body.dataSource,
          calculation: body.calculation,
          visualizationType: body.visualizationType,
          targetValue: body.targetValue != null ? String(body.targetValue) : null,
          warningThreshold: body.warningThreshold != null ? String(body.warningThreshold) : null,
          criticalThreshold: body.criticalThreshold != null ? String(body.criticalThreshold) : null,
          alertEnabled: body.alertEnabled,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'target.create',
        resourceType: 'kpi_configurations',
        resourceId: row.id,
        details: { name: body.name, metricType: body.metricType, dataSource: body.dataSource, targetValue: body.targetValue ?? null },
      });
      return row;
    });
  },
);
