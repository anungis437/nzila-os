/**
 * Integration extensions endpoint
 * GET /api/extensions/[id] — get a single integration config
 * PATCH /api/extensions/[id] — update integration config
 * DELETE /api/extensions/[id] — remove integration
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { apiIntegrations } from '@/db/schema/integration-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  syncFrequency: z.string().max(50).optional(),
  fieldMapping: z.record(z.string(), z.unknown()).optional(),
  apiEndpoint: z.string().url().max(2000).optional(),
});

export const dynamic = 'force-dynamic';

/**
 * An integration row holds the credentials document and the connection's SFTP host, port and path. None of that is returned: the
 * configuration an administrator needs to see is the connection's identity, its mapping and its sync state.
 */
function publicIntegration<T extends Record<string, unknown>>(row: T) {
  const { credentials: _credentials, sftpHost: _host, sftpPort: _port, sftpPath: _path, ...safe } = row;
  return safe;
}

export const GET = withApi(
  {
    // The connection's endpoint, mapping and sync state are an administrator's, not every member's.
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Integrations'],
      summary: 'Get integration by ID',
      description: 'Returns a single integration configuration.',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [integration] = await db
      .select()
      .from(apiIntegrations)
      .where(
        and(
          eq(apiIntegrations.id, params.id),
          eq(apiIntegrations.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!integration) throw ApiError.notFound('Integration');

    return publicIntegration(integration);
  },
);

export const PATCH = withApi(
  {
    // Rewriting an integration's endpoint and field mapping redirects where organization data is sent: an administrator's act, as the delete is.
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Integrations'],
      summary: 'Update integration',
      description: 'Updates an integration configuration.',
    },
  },
  async ({ params, request, organizationId, userId }) => {
    const raw = await request.json();
    const { name, enabled, syncFrequency, fieldMapping, apiEndpoint } = updateIntegrationSchema.parse(raw);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (syncFrequency !== undefined) updates.syncFrequency = syncFrequency;
    if (fieldMapping !== undefined) updates.fieldMapping = fieldMapping;
    if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;

    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [updated] = await tx
        .update(apiIntegrations)
        .set(updates)
        .where(
          and(
            eq(apiIntegrations.id, params.id),
            eq(apiIntegrations.organizationId, organizationId),
          ),
        )
        .returning();

      if (!updated) throw ApiError.notFound('Integration');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'integration.update',
        resourceType: 'api_integrations',
        resourceId: params.id,
        details: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
      });

      return publicIntegration(updated);
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Integrations'],
      summary: 'Delete integration',
      description: 'Removes an integration configuration.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    return withRLSContext({ organizationId }, async (tx) => {
      const [deleted] = await tx
        .delete(apiIntegrations)
        .where(
          and(
            eq(apiIntegrations.id, params.id),
            eq(apiIntegrations.organizationId, organizationId),
          ),
        )
        .returning({ id: apiIntegrations.id, name: apiIntegrations.name });

      if (!deleted) throw ApiError.notFound('Integration');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'integration.delete',
        resourceType: 'api_integrations',
        resourceId: deleted.id,
        details: { name: deleted.name },
      });

      return { id: deleted.id, deleted: true };
    });
  },
);
