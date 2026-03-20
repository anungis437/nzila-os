/**
 * @nzila/zonga-events — Check-in Engine
 *
 * QR-based ticket validation, duplicate scan detection,
 * offline cache mode, and conflict resolution.
 */
import { ScanResult, TicketStatus } from './types'
import type { TicketHolder, TicketScan, EventSession } from './types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface CheckInResult {
  readonly result: (typeof ScanResult)[keyof typeof ScanResult]
  readonly holderId: string | null
  readonly message: string
  readonly scannedAt: Date
}

export interface OfflineScanRecord {
  readonly ticketId: string
  readonly eventId: string
  readonly sessionId: string | null
  readonly scannedAt: Date
  readonly scannerDeviceId: string
  readonly synced: boolean
}

export interface ConflictResolution {
  readonly hasConflict: boolean
  readonly winner: OfflineScanRecord | null
  readonly reason: string | null
}

// ── Scan Validation ───────────────────────────────────────────────────────

/**
 * Validate a ticket scan attempt — core check-in logic.
 * Handles wrong event, already scanned, cancelled tickets, and session mismatch.
 */
export function validateScan(
  ticketId: string,
  eventId: string,
  sessionId: string | null,
  holder: TicketHolder | undefined,
  existingScans: readonly TicketScan[],
  activeSessions: readonly EventSession[],
  now?: Date,
): CheckInResult {
  const scannedAt = now ?? new Date()

  // Ticket not found
  if (!holder) {
    return { result: ScanResult.INVALID, holderId: null, message: 'Ticket not found', scannedAt }
  }

  // Wrong event
  if (holder.eventId !== eventId) {
    return {
      result: ScanResult.WRONG_EVENT,
      holderId: holder.id,
      message: 'Ticket is for a different event',
      scannedAt,
    }
  }

  // Session validation is done below — TicketHolder is event-scoped, not session-scoped

  // Cancelled ticket
  if (holder.status === TicketStatus.CANCELLED || holder.status === TicketStatus.REFUNDED) {
    return {
      result: ScanResult.INVALID,
      holderId: holder.id,
      message: `Ticket is ${holder.status}`,
      scannedAt,
    }
  }

  // Already scanned (duplicate)
  const priorScan = existingScans.find((s) => s.ticketId === ticketId && s.result === ScanResult.VALID)
  if (priorScan) {
    return {
      result: ScanResult.ALREADY_SCANNED,
      holderId: holder.id,
      message: `Ticket already scanned at ${priorScan.scannedAt.toISOString()}`,
      scannedAt,
    }
  }

  // Session not active (if session-gated event)
  if (sessionId) {
    const session = activeSessions.find((s) => s.id === sessionId)
    if (!session) {
      return {
        result: ScanResult.WRONG_SESSION,
        holderId: holder.id,
        message: 'Session not found',
        scannedAt,
      }
    }
    if (session.status !== 'live' && session.status !== 'scheduled') {
      return {
        result: ScanResult.EXPIRED,
        holderId: holder.id,
        message: `Session is ${session.status}`,
        scannedAt,
      }
    }
  }

  // Valid scan
  return {
    result: ScanResult.VALID,
    holderId: holder.id,
    message: 'Check-in successful',
    scannedAt,
  }
}

// ── Offline Sync ──────────────────────────────────────────────────────────

/**
 * Resolve conflicts when multiple devices scan the same ticket offline.
 * First-writer-wins strategy: the earliest scan timestamp wins.
 */
export function resolveOfflineConflicts(
  records: readonly OfflineScanRecord[],
): ConflictResolution[] {
  // Group by ticketId
  const byTicket = new Map<string, OfflineScanRecord[]>()
  for (const record of records) {
    const existing = byTicket.get(record.ticketId) ?? []
    existing.push(record)
    byTicket.set(record.ticketId, existing)
  }

  const results: ConflictResolution[] = []
  for (const [, scans] of byTicket) {
    if (scans.length <= 1) {
      results.push({ hasConflict: false, winner: scans[0] ?? null, reason: null })
      continue
    }

    // Sort by timestamp — earliest wins
    const sorted = [...scans].sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime())
    results.push({
      hasConflict: true,
      winner: sorted[0]!,
      reason: `${scans.length} scans detected — earliest scan at ${sorted[0]!.scannedAt.toISOString()} wins`,
    })
  }

  return results
}

/**
 * Build an offline scan cache map for fast lookup by ticketId.
 */
export function buildOfflineCache(
  records: readonly OfflineScanRecord[],
): Map<string, OfflineScanRecord> {
  const cache = new Map<string, OfflineScanRecord>()
  for (const record of records) {
    const existing = cache.get(record.ticketId)
    // Keep earliest scan
    if (!existing || record.scannedAt < existing.scannedAt) {
      cache.set(record.ticketId, record)
    }
  }
  return cache
}

// ── Check-in Stats ────────────────────────────────────────────────────────

export interface CheckInStats {
  readonly totalTickets: number
  readonly checkedIn: number
  readonly checkInRate: number
  readonly byTier: Record<string, { total: number; checkedIn: number }>
}

/**
 * Compute check-in statistics for an event.
 */
export function computeCheckInStats(
  holders: readonly TicketHolder[],
  scans: readonly TicketScan[],
): CheckInStats {
  const validScans = new Set(
    scans.filter((s) => s.result === ScanResult.VALID).map((s) => s.ticketId),
  )

  const activeHolders = holders.filter(
    (h) => h.status !== TicketStatus.CANCELLED && h.status !== TicketStatus.REFUNDED,
  )

  const byTier: Record<string, { total: number; checkedIn: number }> = {}
  for (const holder of activeHolders) {
    const tier = holder.tier
    if (!byTier[tier]) {
      byTier[tier] = { total: 0, checkedIn: 0 }
    }
    byTier[tier]!.total++
    if (validScans.has(holder.id)) {
      byTier[tier]!.checkedIn++
    }
  }

  const totalTickets = activeHolders.length
  const checkedIn = activeHolders.filter((h) => validScans.has(h.id)).length
  const checkInRate = totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 10000) / 100 : 0

  return { totalTickets, checkedIn, checkInRate, byTier }
}
