/**
 * Shopify Credential Lookup
 *
 * Resolves Shopify integration credentials by shop domain.
 * Keeps DB access out of the API route layer (ARCH_LAYER_001).
 */
import { db, commerceShopifyCredentials } from '@nzila/db'
import { eq } from 'drizzle-orm'

export async function findShopifyCredentialsByDomain(shopDomain: string) {
  const [credentials] = await db
    .select()
    .from(commerceShopifyCredentials)
    .where(eq(commerceShopifyCredentials.shopDomain, shopDomain))
    .limit(1)
  return credentials ?? null
}
