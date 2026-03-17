/**
 * Zoho Credential Lookup
 *
 * Resolves Zoho CRM credentials by org ID.
 * Keeps DB access out of the API route layer (ARCH_LAYER_001).
 */
import { db, commerceZohoCredentials } from '@nzila/db'
import { eq } from 'drizzle-orm'

export async function findZohoCredentialsByOrg(orgId: string) {
  const [credentials] = await db
    .select()
    .from(commerceZohoCredentials)
    .where(eq(commerceZohoCredentials.orgId, orgId))
    .limit(1)
  return credentials ?? null
}
