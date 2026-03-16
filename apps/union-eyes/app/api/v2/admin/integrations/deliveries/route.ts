/**
 * GET /api/v2/admin/integrations/deliveries
 * Query integration delivery history with filtering and pagination.
 *
 * @role integration_manager
 */
import { withApi, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'List integration deliveries',
      description: 'Returns paginated delivery history with status and provider filtering.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const status = url.searchParams.get('status');
    const provider = url.searchParams.get('provider');
    const offset = (page - 1) * limit;

    let whereClause = sql`org_id = ${organizationId}::uuid`;
    if (status) {
      whereClause = sql`${whereClause} AND status = ${status}`;
    }
    if (provider) {
      whereClause = sql`${whereClause} AND provider = ${provider}`;
    }

    const [countResult, deliveries] = await Promise.all([
      db.execute(sql`
        SELECT count(*)::int AS total
        FROM integration_deliveries
        WHERE ${whereClause}
      `),
      db.execute(sql`
        SELECT id, config_id, channel, provider, recipient_ref,
               status, attempts, max_attempts, last_error,
               provider_message_id, correlation_id, created_at, updated_at
        FROM integration_deliveries
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
    ]);

    const total = (Array.from(countResult)[0] as Record<string, unknown>)?.total as number ?? 0;
    const rows = Array.from(deliveries).map((r: Record<string, unknown>) => ({
      id: r.id,
      configId: r.config_id,
      channel: r.channel,
      provider: r.provider,
      recipientRef: r.recipient_ref,
      status: r.status,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      lastError: r.last_error,
      providerMessageId: r.provider_message_id,
      correlationId: r.correlation_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return {
      deliveries: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
);
