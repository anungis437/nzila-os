import { withApi, z } from '@/lib/api/framework';
import { setIntegrationActivationForOrg } from '@/lib/integrations/control-plane';

export const dynamic = 'force-dynamic';

const activationSchema = z.object({
  enabled: z.boolean(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: activationSchema,
    registry: {
      audience: 'steward',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
  },
  async ({ body, organizationId, params }) => {
    return {
      integration: await setIntegrationActivationForOrg(organizationId!, params.id, body.enabled),
    };
  },
);
