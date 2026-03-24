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

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
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

    return { data: integration };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Integrations'],
      summary: 'Update integration',
      description: 'Updates an integration configuration.',
    },
  },
  async ({ params, request, organizationId }) => {
    const body = await request.json();
    const { name, enabled, syncFrequency, fieldMapping, apiEndpoint } = body as {
      name?: string;
      enabled?: boolean;
      syncFrequency?: string;
      fieldMapping?: Record<string, unknown>;
      apiEndpoint?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (syncFrequency !== undefined) updates.syncFrequency = syncFrequency;
    if (fieldMapping !== undefined) updates.fieldMapping = fieldMapping;
    if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;

    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [updated] = await db
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

    return { data: updated };
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
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [deleted] = await db
      .delete(apiIntegrations)
      .where(
        and(
          eq(apiIntegrations.id, params.id),
          eq(apiIntegrations.organizationId, organizationId),
        ),
      )
      .returning({ id: apiIntegrations.id });

    if (!deleted) throw ApiError.notFound('Integration');

    return { data: { id: deleted.id, deleted: true } };
  },
);
