import type { RLSTx } from '@/lib/db/with-rls-context'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { appendCanonicalAuditLog, type CanonicalAuditEntry } from './canonical-audit-chain'

/**
 * Mandatory audit inside the caller's transaction. A failure throws, so the protected mutation
 * rolls back with it. Returns false outside Canonical V2, where the legacy best-effort writer
 * remains the caller's responsibility.
 */
export async function appendMandatoryAudit(
  tx: RLSTx,
  entry: CanonicalAuditEntry,
): Promise<boolean> {
  if (!currentStateContextEnabled()) return false
  await appendCanonicalAuditLog(tx, entry)
  return true
}
