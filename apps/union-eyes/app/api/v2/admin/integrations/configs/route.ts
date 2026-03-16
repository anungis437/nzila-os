/**
 * GET POST /api/v2/admin/integrations/configs
 * Enterprise integration configuration management.
 * List all integration configs or create a new one.
 *
 * @role integration_manager
 */
import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql, eq, and, desc, count } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ── GET — list integration configs ─────────────────────────────────────────

export const GET = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'List enterprise integration configs',
      description: 'Returns integration configs for the authenticated organization with status summary.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');
    const status = url.searchParams.get('status');

    let whereClause = sql`organization_id = ${organizationId}::uuid`;
    if (domain) {
      whereClause = sql`${whereClause} AND metadata->>'domain' = ${domain}`;
    }
    if (status) {
      whereClause = sql`${whereClause} AND status = ${status}`;
    }

    const configs = await db.execute(sql`
      SELECT id, org_id, type, provider, status, metadata,
             credentials_ref, created_by, created_at, updated_at
      FROM integration_configs
      WHERE ${whereClause}
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 WHEN 'suspended' THEN 2 END,
        created_at DESC
    `);

    const rows = Array.from(configs).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      orgId: r.org_id as string,
      type: r.type as string,
      provider: r.provider as string,
      status: r.status as string,
      metadata: r.metadata as Record<string, unknown>,
      credentialsRef: r.credentials_ref as string,
      createdBy: r.created_by as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    const summary = {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      inactive: rows.filter((r) => r.status === 'inactive').length,
      suspended: rows.filter((r) => r.status === 'suspended').length,
    };

    return { configs: rows, summary };
  },
);

// ── POST — create integration config ───────────────────────────────────────

const createConfigSchema = z.object({
  type: z.string().min(1),
  provider: z.string().min(1),
  credentialsRef: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    body: createConfigSchema,
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Create integration config',
      description: 'Creates a new integration configuration for the organization.',
    },
  },
  async ({ body, organizationId, userId }) => {
    // Check for duplicate provider in same org
    const existing = await db.execute(sql`
      SELECT id FROM integration_configs
      WHERE org_id = ${organizationId}::uuid
        AND provider = ${body.provider}
        AND status != 'suspended'
      LIMIT 1
    `);

    if (Array.from(existing).length > 0) {
      throw new ApiError(409, `Integration config for provider "${body.provider}" already exists`);
    }

    const result = await db.execute(sql`
      INSERT INTO integration_configs (org_id, type, provider, credentials_ref, metadata, status, created_by)
      VALUES (
        ${organizationId}::uuid,
        ${body.type},
        ${body.provider},
        ${body.credentialsRef},
        ${JSON.stringify(body.metadata ?? {})}::jsonb,
        'inactive',
        ${userId}
      )
      RETURNING id, org_id, type, provider, status, metadata, credentials_ref, created_by, created_at, updated_at
    `);

    const row = Array.from(result)[0] as Record<string, unknown>;
    logger.info('Integration config created', {
      orgId: organizationId,
      configId: row.id,
      provider: body.provider,
      userId,
    });

    return {
      config: {
        id: row.id,
        orgId: row.org_id,
        type: row.type,
        provider: row.provider,
        status: row.status,
        metadata: row.metadata,
        createdAt: row.created_at,
      },
    };
  },
);
