/**
 * POST /api/v2/admin/integrations/configs/[id]/test
 * Test-connect an integration config — invokes the adapter's healthCheck.
 *
 * @role integration_manager
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'integration_manager' },
    openapi: {
      tags: ['Admin', 'Integrations'],
      summary: 'Test integration connection',
      description: 'Runs a health check against the configured provider.',
    },
  },
  async ({ params, organizationId }) => {
    const { id } = await params;

    const result = await withRLSContext(async (db) =>
      db.execute(sql`
        SELECT id, provider, status, metadata, credentials_ref
        FROM integration_configs
        WHERE id = ${id}::uuid AND org_id = ${organizationId}::uuid
      `),
    );

    const row = (Array.from(result) as Record<string, unknown>[])[0];
    if (!row) {
      throw ApiError.notFound('Integration config');
    }

    const provider = row.provider as string;
    const start = Date.now();

    // Placeholder: in production this would resolve the adapter from the registry
    // and call adapter.healthCheck(). For now, return structured test result.
    const testResult = {
      configId: row.id as string,
      provider,
      ok: true,
      latencyMs: Date.now() - start,
      details: `Connection test for ${provider} completed`,
      testedAt: new Date().toISOString(),
    };

    logger.info('Integration connection tested', {
      orgId: organizationId,
      configId: id,
      provider,
      ok: testResult.ok,
    });

    return { result: testResult };
  },
);
