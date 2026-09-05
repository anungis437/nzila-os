import { withApi, z } from '@/lib/api/framework';
import {
  configureIntegrationForOrg,
  listIntegrationConfigsForOrg,
} from '@/lib/integrations/control-plane';
import { IntegrationProvider, IntegrationType } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

const configureSchema = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  type: z.nativeEnum(IntegrationType),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  credentialRef: z.string().min(1).max(255).optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    registry: {
      audience: 'steward',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
  },
  async ({ organizationId }) => {
    return {
      integrations: await listIntegrationConfigsForOrg(organizationId!),
    };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: configureSchema,
    registry: {
      audience: 'steward',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
    successStatus: 201,
  },
  async ({ body, organizationId }) => {
    return {
      integration: await configureIntegrationForOrg(organizationId!, body),
    };
  },
);
