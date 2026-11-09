import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { initiateTenantIntegrationSync } from '@/lib/integrations/control-plane';
import { SyncType } from '@/lib/integrations/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  syncType: z.nativeEnum(SyncType),
  entities: z.array(z.string().trim().min(1).max(100)).max(25).optional(),
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(10_000).optional(),
}).strict();

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    requireOrg: true,
    body: bodySchema,
    openapi: { tags: ['Integrations'], summary: 'Run an enabled tenant integration configuration' },
  },
  async ({ params, body, organizationId, userId }) => ({
    result: await initiateTenantIntegrationSync(organizationId!, userId!, {
      integrationId: params.id,
      syncType: body.syncType,
      entities: body.entities,
      dryRun: body.dryRun,
      limit: body.limit,
    }),
  }),
);
