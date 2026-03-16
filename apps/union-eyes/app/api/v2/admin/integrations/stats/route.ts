/**
 * GET /api/v2/admin/integrations/stats
 * Aggregate integration health + delivery statistics.
 *
 * @role integration_manager
 */
import { withApi } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Integration stats',
      description: 'Returns aggregate counts of configs, deliveries, and DLQ items.',
    },
  },
  async ({ organizationId }) => {
    const [configStats, deliveryStats, dlqCount] = await withRLSContext(
      { organizationId },
      async (db) => Promise.all([
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE status = 'inactive')::int AS inactive,
            count(*) FILTER (WHERE status = 'suspended')::int AS suspended
          FROM integration_configs
          WHERE org_id = ${organizationId}::uuid
        `),
        db.execute(sql`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE status = 'sent')::int AS sent,
            count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'queued')::int AS queued,
            count(*) FILTER (WHERE status = 'dlq')::int AS dlq
          FROM integration_deliveries
          WHERE org_id = ${organizationId}::uuid
        `),
        db.execute(sql`
          SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE replayed_at IS NULL)::int AS pending
          FROM integration_dlq
          WHERE org_id = ${organizationId}::uuid
        `),
      ]),
    );

    const cfgRow = Array.from(configStats)[0] as Record<string, unknown>;
    const delRow = Array.from(deliveryStats)[0] as Record<string, unknown>;
    const dlqRow = Array.from(dlqCount)[0] as Record<string, unknown>;

    const totalSent = (delRow?.sent as number) ?? 0;
    const totalFailed = (delRow?.failed as number) ?? 0;
    const totalDeliveries = totalSent + totalFailed;
    const successRate = totalDeliveries > 0
      ? Math.round((totalSent / totalDeliveries) * 1000) / 10
      : 100;

    return {
      configs: {
        total: cfgRow?.total ?? 0,
        active: cfgRow?.active ?? 0,
        inactive: cfgRow?.inactive ?? 0,
        suspended: cfgRow?.suspended ?? 0,
      },
      deliveries: {
        total: delRow?.total ?? 0,
        sent: totalSent,
        failed: totalFailed,
        queued: delRow?.queued ?? 0,
        successRate,
      },
      dlq: {
        total: dlqRow?.total ?? 0,
        pendingReplay: dlqRow?.pending ?? 0,
      },
    };
  },
);
