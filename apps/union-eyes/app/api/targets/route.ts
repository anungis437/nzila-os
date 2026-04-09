import { db } from '@/db/db';
import { kpiConfigurations } from '@/db/schema';
import { withApi, z } from '@/lib/api/framework';

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
    const [row] = await db
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
        targetValue: body.targetValue != null ? String(body.targetValue) : null,
        warningThreshold: body.warningThreshold != null ? String(body.warningThreshold) : null,
        criticalThreshold: body.criticalThreshold != null ? String(body.criticalThreshold) : null,
        alertEnabled: body.alertEnabled,
      })
      .returning();

    return row;
  },
);
