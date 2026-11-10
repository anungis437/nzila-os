/**
 * Compatibility item route for the canonical integration control plane.
 *
 * The former implementation wrote the disconnected `api_integrations` table,
 * whose rows no sync consumer read. Keeping that second authority root made a
 * configuration appear effective when it could never run. This route now
 * delegates to the same versioned, credential-bound configuration and sync
 * lifecycle as `/api/integrations/framework`.
 */
import { ApiError, withApi, z } from '@/lib/api/framework';
import {
  configureIntegrationForOrg,
  getIntegrationConfigForOrg,
  setIntegrationActivationForOrg,
} from '@/lib/integrations/control-plane';
import { IntegrationProvider, IntegrationType } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  type: z.nativeEnum(IntegrationType),
  enabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  credentialRef: z.string().trim().min(1).max(255).optional(),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    openapi: { tags: ['Integrations'], summary: 'Get a canonical integration configuration' },
  },
  async ({ params, organizationId }) => ({
    integration: await getIntegrationConfigForOrg(organizationId!, params.id),
  }),
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    body: updateSchema,
    openapi: { tags: ['Integrations'], summary: 'Create a new immutable version of an integration configuration' },
  },
  async ({ params, body, organizationId, userId }) => {
    const current = await getIntegrationConfigForOrg(organizationId!, params.id);
    if (current.provider !== body.provider || current.type !== body.type) {
      throw ApiError.conflict('Provider and integration type are immutable for an existing configuration');
    }
    return {
      integration: await configureIntegrationForOrg(organizationId!, body, userId!),
    };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    openapi: { tags: ['Integrations'], summary: 'Deactivate an integration without erasing its history' },
  },
  async ({ params, organizationId, userId }) => ({
    integration: await setIntegrationActivationForOrg(organizationId!, params.id, false, userId!),
    deleted: false,
    deactivated: true,
  }),
);
