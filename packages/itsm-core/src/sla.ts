/**
 * @nzila/itsm-core — SLA engine
 *
 * Pure functions for computing SLA due timestamps and evaluating breach status.
 * No I/O — call from ticket creation and cron jobs.
 */
import type { Priority, SlaTargets } from './types'

// ── Default SLA targets (fallback when no profile is configured) ──────────────

export const DEFAULT_SLA_TARGETS: SlaTargets = {
  p1_critical: { responseMinutes: 15, resolutionMinutes: 240 },
  p2_high: { responseMinutes: 60, resolutionMinutes: 480 },
  p3_medium: { responseMinutes: 240, resolutionMinutes: 1440 },
  p4_low: { responseMinutes: 480, resolutionMinutes: 2880 },
}

/**
 * Compute SLA due ISO timestamps for a newly created ticket.
 */
export function computeSlaDueDates(
  priority: Priority,
  targets: SlaTargets,
  now: Date = new Date(),
): { responseDue: string; resolutionDue: string } {
  const target = targets[priority]
  const responseDue = new Date(now.getTime() + target.responseMinutes * 60_000)
  const resolutionDue = new Date(now.getTime() + target.resolutionMinutes * 60_000)
  return {
    responseDue: responseDue.toISOString(),
    resolutionDue: resolutionDue.toISOString(),
  }
}

/**
 * Determine whether the resolution SLA has been breached.
 * Returns true if current time is past the due date and ticket is not resolved/closed.
 */
export function isSlaBreached(
  resolutionDue: string | null | undefined,
  status: string,
  now: Date = new Date(),
): boolean {
  if (!resolutionDue) return false
  if (status === 'resolved' || status === 'closed') return false
  return now.getTime() > new Date(resolutionDue).getTime()
}

/**
 * Compute minutes remaining until SLA breach (negative if already breached).
 */
export function minutesUntilBreach(
  resolutionDue: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!resolutionDue) return null
  return Math.floor((new Date(resolutionDue).getTime() - now.getTime()) / 60_000)
}

/**
 * Compute SLA attainment rate for a set of tickets.
 * @param tickets — array of objects with slaBreached field
 * @returns Percentage 0-100
 */
export function computeSlaAttainment(
  tickets: ReadonlyArray<{ slaBreached: boolean }>,
): number {
  if (tickets.length === 0) return 100
  const breached = tickets.filter((t) => t.slaBreached).length
  return Math.round(((tickets.length - breached) / tickets.length) * 100)
}

/**
 * Compute mean time to resolution (MTTR) in minutes.
 */
export function computeMttr(
  tickets: ReadonlyArray<{
    createdAt: string
    resolvedAt: string | null | undefined
  }>,
): number | null {
  const resolved = tickets.filter((t) => t.resolvedAt)
  if (resolved.length === 0) return null
  const totalMinutes = resolved.reduce((acc, t) => {
    const created = new Date(t.createdAt).getTime()
    const resolvedTime = new Date(t.resolvedAt!).getTime()
    return acc + (resolvedTime - created) / 60_000
  }, 0)
  return Math.round(totalMinutes / resolved.length)
}
