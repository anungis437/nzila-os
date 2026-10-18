/**
 * Auth organization storage adapter. As in Flow's org-resolver, provider IDs
 * remain mapped to the legacy column; this is not an identity/data migration.
 */
import { platformDb } from '@nzila/db/platform'
import { orgs } from '@nzila/db'
import { eq } from 'drizzle-orm'

export function findAuthOrganization(authOrgId: string) {
  return platformDb.select({ id: orgs.id }).from(orgs)
    .where(eq(orgs.clerkOrgId, authOrgId)).limit(1)
}

export function createAuthOrganization(authOrgId: string, name: string) {
  return platformDb.insert(orgs).values({
    clerkOrgId: authOrgId, legalName: name, jurisdiction: 'CA-ON', status: 'active',
  })
}

export function updateAuthOrganization(authOrgId: string, name: string) {
  return platformDb.update(orgs).set({ legalName: name, updatedAt: new Date() })
    .where(eq(orgs.clerkOrgId, authOrgId))
}
