import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { withSystemContext } from '@/lib/db/with-rls-context'

/**
 * Runs work on tables that are tenant-owned (TENANT_RLS / PARENT_OWNED_RLS) for a handler that
 * already executes inside its canonical tenant transaction. Canonical V2 keeps the caller's own
 * organization RLS context (the SYSTEM role has no grants on these tables); legacy mode keeps
 * its historical SYSTEM context.
 */
export function withOrgOwnedContext<T>(operation: () => Promise<T>): Promise<T> {
  return currentStateContextEnabled() ? operation() : withSystemContext(operation)
}
