import { withApi, z } from '@/lib/api/framework';
import { initiateTenantIntegrationSync } from '@/lib/integrations/control-plane';
import { SyncType } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

const syncSchema = z.object({
  syncType: z.nativeEnum(SyncType).default(SyncType.INCREMENTAL),
  entities: z.array(z.string().min(1).max(100)).max(20).optional(),
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: syncSchema,
    registry: {
      audience: 'steward',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
  },
  async ({ body, organizationId, userId, params }) => {
    return {
      result: await initiateTenantIntegrationSync(organizationId!, userId!, {
        integrationId: params.id,
        syncType: body.syncType,
        entities: body.entities,
        dryRun: body.dryRun,
        limit: body.limit,
      }),
    };
  },
);
