/** Keep one verified bridge alive through the outer transaction's deferred checks. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { AuthOrgBindingError, type AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { tenantContextStorage } from '@/db/tenant-context-storage'
import { getActiveSystemDb } from '@/db/system-context-storage'
import type { RLSTx } from './with-rls-context'

const scopes = new AsyncLocalStorage<{ tx: RLSTx; binding: AuthenticatedOrgBinding }>()

/** Internal server boundary: called only after attaching a verified binding to this transaction. */
export function withCanonicalTenantScope<T>(
  tx: RLSTx,
  binding: AuthenticatedOrgBinding,
  operation: (tx: RLSTx) => Promise<T>,
): Promise<T> {
  return scopes.run({ tx, binding }, () => tenantContextStorage.run(tx, () => operation(tx)))
}

export async function nestedCanonicalTenantScope<T>(
  actorUserId: string,
  organizationId: string | undefined,
  operation: (tx: RLSTx) => Promise<T>,
): Promise<{ nested: false } | { nested: true; value: T }> {
  const active = scopes.getStore()
  if (!active) return { nested: false }
  if (getActiveSystemDb()) throw new AuthOrgBindingError('ROLE_REQUIRED')
  if (active.binding.userId !== actorUserId) throw new AuthOrgBindingError('ACTOR_MISMATCH')
  if (
    organizationId &&
    organizationId.toLowerCase() !== active.binding.organizationId.toLowerCase()
  )
    throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  // Retain the savepoint rollback boundary, but never overwrite the outer
  // transaction's GUCs with a second bridge that ends before its commit.
  const value = await active.tx.transaction((tx) =>
    withCanonicalTenantScope(tx, active.binding, operation),
  )
  return { nested: true, value }
}
