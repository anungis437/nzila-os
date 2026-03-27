/**
 * @nzila/ue-assistant — Audit & Logging (Phase 11)
 *
 * Immutable audit logging for every AI assistant interaction. Logs are
 * hash-chained, org-scoped, and include full context for reproducibility.
 */
import { createHash, randomUUID } from 'node:crypto'
import {
  auditLogEntrySchema,
  type AuditLogEntry,
  type UEAssistantRole,
  type IntentType,
  type ResponseType,
  type RoleMode,
  type ToolName,
} from './types'

// ── Audit Store ─────────────────────────────────────────────────────────────

const auditLog: AuditLogEntry[] = []
let previousHash: string = '0'.repeat(64)

// ── Hash Chain ──────────────────────────────────────────────────────────────

function computeEntryHash(entry: AuditLogEntry, prevHash: string): string {
  return createHash('sha256')
    .update(prevHash)
    .update(JSON.stringify(entry))
    .digest('hex')
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Record an audit log entry. Returns the entry with its generated ID.
 * Each entry is hash-chained to the previous entry for tamper detection.
 */
export function recordAuditEntry(params: {
  userId: string
  orgId: string
  role: UEAssistantRole
  intent: IntentType
  query: string
  responseType: ResponseType
  mode: RoleMode
  sourcesUsed: readonly string[]
  toolsInvoked: readonly ToolName[]
  dataAccessed: readonly string[]
  escalationTriggered: boolean
  confidence: number
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: randomUUID(),
    userId: params.userId,
    orgId: params.orgId,
    role: params.role,
    intent: params.intent,
    query: params.query,
    responseType: params.responseType,
    mode: params.mode,
    sourcesUsed: [...params.sourcesUsed],
    toolsInvoked: [...params.toolsInvoked],
    dataAccessed: [...params.dataAccessed],
    escalationTriggered: params.escalationTriggered,
    confidence: params.confidence,
    timestamp: new Date().toISOString(),
  }

  // Validate against schema
  auditLogEntrySchema.parse(entry)

  // Hash-chain
  previousHash = computeEntryHash(entry, previousHash)

  auditLog.push(entry)
  return entry
}

/**
 * Get the full audit log.
 */
export function getAuditLog(): readonly AuditLogEntry[] {
  return [...auditLog]
}

/**
 * Get audit entries for a specific org.
 */
export function getAuditLogByOrg(orgId: string): readonly AuditLogEntry[] {
  return auditLog.filter((e) => e.orgId === orgId)
}

/**
 * Get audit entries for a specific user.
 */
export function getAuditLogByUser(userId: string): readonly AuditLogEntry[] {
  return auditLog.filter((e) => e.userId === userId)
}

/**
 * Verify the integrity of the audit chain. Returns true if the chain
 * is intact (no tampering detected).
 */
export function verifyAuditChain(): boolean {
  let hash = '0'.repeat(64)
  for (const entry of auditLog) {
    hash = computeEntryHash(entry, hash)
  }
  return hash === previousHash
}

/**
 * Get the current chain hash (for external verification).
 */
export function getChainHash(): string {
  return previousHash
}

/**
 * Clear the audit log (for testing only).
 */
export function clearAuditLog(): void {
  auditLog.length = 0
  previousHash = '0'.repeat(64)
}

/**
 * Get the number of logged entries.
 */
export function getAuditLogSize(): number {
  return auditLog.length
}
