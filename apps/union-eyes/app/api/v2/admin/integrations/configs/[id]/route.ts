/**
 * GET PATCH DELETE /api/v2/admin/integrations/configs/[id]
 * Manage a single integration config — view, update status, or remove.
 *
 * @role integration_manager
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// ── GET — single config ────────────────────────────────────────────────────

export const GET = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Get integration config',
    },
  },
  async ({ params, organizationId }) => {
    const { id } = await params;

    const result = await db.execute(sql`
      SELECT id, org_id, type, provider, status, metadata,
             credentials_ref, created_by, created_at, updated_at
      FROM integration_configs
      WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
    `);

    const row = Array.from(result)[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new ApiError(404, 'Integration config not found');
    }

    return {
      config: {
        id: row.id,
        orgId: row.org_id,
        type: row.type,
        provider: row.provider,
        status: row.status,
        metadata: row.metadata,
        credentialsRef: row.credentials_ref,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  },
);

// ── PATCH — update config ──────────────────────────────────────────────────

const updateConfigSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  metadata: z.record(z.unknown()).optional(),
  credentialsRef: z.string().min(1).optional(),
});

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    body: updateConfigSchema,
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Update integration config',
    },
  },
  async ({ params, body, organizationId, userId }) => {
    const { id } = await params;

    // Build SET clause dynamically
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];

    if (body.status) {
      sets.push(`status = $${values.length + 1}`);
      values.push(body.status);
    }
    if (body.metadata) {
      sets.push(`metadata = $${values.length + 1}::jsonb`);
      values.push(JSON.stringify(body.metadata));
    }
    if (body.credentialsRef) {
      sets.push(`credentials_ref = $${values.length + 1}`);
      values.push(body.credentialsRef);
    }

    if (sets.length === 1) {
      throw new ApiError(400, 'No fields to update');
    }

    // Use template literal for the update
    let updateSql;
    if (body.status && !body.metadata && !body.credentialsRef) {
      updateSql = sql`
        UPDATE integration_configs
        SET status = ${body.status}, updated_at = NOW()
        WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
        RETURNING id, status, updated_at
      `;
    } else if (body.metadata && !body.status && !body.credentialsRef) {
      updateSql = sql`
        UPDATE integration_configs
        SET metadata = ${JSON.stringify(body.metadata)}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
        RETURNING id, status, updated_at
      `;
    } else {
      // Full update
      updateSql = sql`
        UPDATE integration_configs
        SET status = COALESCE(${body.status ?? null}, status),
            metadata = COALESCE(${body.metadata ? JSON.stringify(body.metadata) : null}::jsonb, metadata),
            credentials_ref = COALESCE(${body.credentialsRef ?? null}, credentials_ref),
            updated_at = NOW()
        WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
        RETURNING id, status, updated_at
      `;
    }

    const result = await db.execute(updateSql);
    const row = Array.from(result)[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new ApiError(404, 'Integration config not found');
    }

    logger.info('Integration config updated', {
      orgId: organizationId,
      configId: id,
      status: body.status,
      userId,
    });

    return { config: row };
  },
);

// ── DELETE — remove config ─────────────────────────────────────────────────

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Delete integration config',
    },
  },
  async ({ params, organizationId, userId }) => {
    const { id } = await params;

    const result = await db.execute(sql`
      DELETE FROM integration_configs
      WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
      RETURNING id, provider
    `);

    const row = Array.from(result)[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new ApiError(404, 'Integration config not found');
    }

    logger.info('Integration config deleted', {
      orgId: organizationId,
      configId: id,
      provider: row.provider,
      userId,
    });

    return { deleted: true, id: row.id };
  },
);
