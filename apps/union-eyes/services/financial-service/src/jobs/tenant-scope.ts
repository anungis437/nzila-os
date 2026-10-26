import { eq } from 'drizzle-orm'

/**
 * Binds a financial-service UPDATE or DELETE to the tenant the caller already holds.
 * The column is `tenant_id` on the shadow schema. The name is the organization token the mutation scanner accepts.
 * This is tenant isolation for a latent job. It does not issue a financial mandate and it is not an approval.
 */
export function inOrganization<Column>(column: Column, tenantId: string) {
  return eq(column as never, tenantId)
}
