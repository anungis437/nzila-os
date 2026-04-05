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
import { healthCheck as hubspotHealthCheck } from '@/lib/services/crm-service';

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

    let ok: boolean;
    let latencyMs: number;
    let details: string;

    // Use the real HubSpot client for health checks
    if (provider === 'hubspot') {
      const hsResult = await hubspotHealthCheck();
      if (!hsResult) {
        latencyMs = Date.now() - start;
        ok = false;
        details = 'HUBSPOT_API_KEY not configured';
      } else {
        latencyMs = hsResult.latencyMs;
        ok = hsResult.ok;
        details = hsResult.error ?? `HubSpot API reachable (${hsResult.latencyMs}ms)`;
      }
    } else {
      const metadata = row.metadata as Record<string, unknown> | null;
      const endpointUrl = (metadata?.endpoint ?? metadata?.url ?? metadata?.base_url) as string | undefined;

      if (endpointUrl) {
        try {
          const probe = await fetch(endpointUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
          });
          latencyMs = Date.now() - start;
          ok = probe.ok || probe.status < 500;
          details = `${provider} responded with HTTP ${probe.status}`;
        } catch (err) {
          latencyMs = Date.now() - start;
          ok = false;
          details = `${provider} connection failed: ${(err as Error).message}`;
        }
      } else {
        latencyMs = Date.now() - start;
        ok = (row.status as string) === 'active';
        details = `${provider} config found (no endpoint to probe)`;
      }
    }

    const testResult = {
      configId: row.id as string,
      provider,
      ok,
      latencyMs,
      details,
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
