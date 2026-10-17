import { getActiveTenantDb } from '@/db/tenant-context-storage'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { withSystemContext } from '@/lib/db/with-rls-context'

/**
 * Runs work on tables that are tenant-owned (TENANT_RLS / PARENT_OWNED_RLS) for a handler that
 * already executes inside its canonical tenant transaction. Canonical V2 keeps the caller's own
 * organization RLS context (the SYSTEM role has no grants on these tables) and fails closed when
 * no tenant transaction is active; legacy mode keeps its historical SYSTEM context.
 */
export function withOrgOwnedContext<T>(operation: () => Promise<T>): Promise<T> {
  if (!currentStateContextEnabled()) return withSystemContext(operation)
  if (!getActiveTenantDb()) {
    return Promise.reject(new Error('ORG_OWNED_CONTEXT_REQUIRES_TENANT_TRANSACTION'))
  }
  return operation()
}
