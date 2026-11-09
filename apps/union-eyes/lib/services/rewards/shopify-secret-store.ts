import { and, desc, eq, sql } from 'drizzle-orm';
import { shopifyConfig, shopifyWebhookSecretVersions } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { ApiError } from '@/lib/api/errors';

const MANAGED_REF = /^env:\/\/(UE_SHOPIFY_[A-Z0-9_]{3,200})$/;
const MAX_OVERLAP_HOURS = 24;

function requireProvisionedRef(secretRef: string): void {
  const match = MANAGED_REF.exec(secretRef);
  if (!match) throw ApiError.badRequest('Shopify secret reference must be env://UE_SHOPIFY_<NAME>');
  if (!process.env[match[1]]) throw ApiError.conflict('The managed Shopify secret is not provisioned');
}

export async function rotateShopifyWebhookSecret(
  tx: RLSTx,
  input: { organizationId: string; userId: string; secretRef: string; overlapHours: number },
) {
  requireProvisionedRef(input.secretRef);
  const overlapHours = Math.min(Math.max(Math.trunc(input.overlapHours), 0), MAX_OVERLAP_HOURS);
  const now = new Date();
  const retiringUntil = new Date(now.getTime() + overlapHours * 60 * 60 * 1000);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify-webhook-secret:${input.organizationId}`}, 0))`);

  const [config] = await tx.select({ orgId: shopifyConfig.orgId }).from(shopifyConfig)
    .where(eq(shopifyConfig.orgId, input.organizationId)).limit(1).for('update');
  if (!config) throw ApiError.notFound('Shopify configuration');

  const [latest] = await tx.select({ version: shopifyWebhookSecretVersions.version })
    .from(shopifyWebhookSecretVersions)
    .where(eq(shopifyWebhookSecretVersions.orgId, input.organizationId))
    .orderBy(desc(shopifyWebhookSecretVersions.version)).limit(1);

  if (overlapHours > 0) {
    await tx.update(shopifyWebhookSecretVersions).set({ status: 'retiring', validUntil: retiringUntil })
      .where(and(eq(shopifyWebhookSecretVersions.orgId, input.organizationId), eq(shopifyWebhookSecretVersions.status, 'active')));
  } else {
    await tx.update(shopifyWebhookSecretVersions).set({ status: 'revoked', validUntil: now, revokedAt: now, revokedBy: input.userId })
      .where(and(eq(shopifyWebhookSecretVersions.orgId, input.organizationId), eq(shopifyWebhookSecretVersions.status, 'active')));
  }

  const [created] = await tx.insert(shopifyWebhookSecretVersions).values({
    orgId: input.organizationId,
    version: (latest?.version ?? 0) + 1,
    secretRef: input.secretRef,
    status: 'active',
    validFrom: now,
    createdBy: input.userId,
  }).returning({ id: shopifyWebhookSecretVersions.id, version: shopifyWebhookSecretVersions.version });

  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: 'shopify.webhook_secret.rotate',
    resourceType: 'shopify_webhook_secret_versions',
    resourceId: created.id,
    details: { version: created.version, overlapHours },
  });
  return created;
}

export async function revokeShopifyWebhookSecrets(tx: RLSTx, organizationId: string, userId: string) {
  const now = new Date();
  const revoked = await tx.update(shopifyWebhookSecretVersions)
    .set({ status: 'revoked', validUntil: now, revokedAt: now, revokedBy: userId })
    .where(and(
      eq(shopifyWebhookSecretVersions.orgId, organizationId),
      sql`${shopifyWebhookSecretVersions.status} IN ('active', 'retiring')`,
    ))
    .returning({ id: shopifyWebhookSecretVersions.id });
  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'shopify.webhook_secret.revoke',
    resourceType: 'shopify_webhook_secret_versions',
    resourceId: organizationId,
    details: { revokedVersions: revoked.length },
  });
  return { revokedVersions: revoked.length };
}
