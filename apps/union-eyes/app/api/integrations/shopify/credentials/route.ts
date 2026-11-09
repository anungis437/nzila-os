import { withApi, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { revokeShopifyWebhookSecrets, rotateShopifyWebhookSecret } from '@/lib/services/rewards/shopify-secret-store';

export const dynamic = 'force-dynamic';

export const POST = withApi({
  auth: { required: true, minRole: 'steward' },
  body: z.object({ secretRef: z.string().min(1).max(255), overlapHours: z.number().int().min(0).max(24).default(1) }),
  successStatus: 201,
  registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
}, async ({ organizationId, userId, body }) => ({
  credential: await withRLSContext({ organizationId: organizationId!, userId: userId! }, (tx) =>
    rotateShopifyWebhookSecret(tx, { organizationId: organizationId!, userId: userId!, ...body }),
  ),
}));

export const DELETE = withApi({
  auth: { required: true, minRole: 'steward' },
  registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
}, async ({ organizationId, userId }) => withRLSContext(
  { organizationId: organizationId!, userId: userId! },
  (tx) => revokeShopifyWebhookSecrets(tx, organizationId!, userId!),
));
