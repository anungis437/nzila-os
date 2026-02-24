/**
 * Audit logger — backward-compatible wrapper.
 *
 * The real implementation is in ./audit-db.ts which writes to the
 * append-only `audit_events` table with SHA-256 hash-chain integrity.
 *
 * This file is kept for backward compatibility with existing call-sites
 * that use `auditLog()`. New code should import from `@/lib/audit-db`.
 *
 * @deprecated Use `recordAuditEvent` from `@/lib/audit-db` instead.
 */

// Re-export the real implementation
export {
  recordAuditEvent,
  verifyEntityAuditChain,
  exportAuditTrailBuffer,
  AUDIT_ACTIONS,
} from './audit-db'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('audit')

interface AuditEvent {
  userId: string | null
  action: string
  resource: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

/**
 * @deprecated Use `recordAuditEvent` from `@/lib/audit-db` for DB-backed,
 * hash-chained audit logging. This function only writes to stdout.
 */
export function auditLog(event: AuditEvent) {
  const entry = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  }
  logger.info('[AUDIT][LEGACY]', { detail: JSON.stringify(entry) })
}
