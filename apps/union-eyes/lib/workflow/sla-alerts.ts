/**
 * SLA watchdog rules and the durable alert write.
 *
 * Each claim is classified once per run (the deadline was being computed twice per claim, once for events and once for the
 * counts), and an alert is a durable inbox row for the steward the claim is assigned to rather than an event on the in-process bus,
 * which drops an event nobody subscribed to and does not outlive the process that emitted it.
 */
import { sql } from 'drizzle-orm'
import { slaClockStart } from './sla-clock'
import { inAppNotifications } from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { getSLADeadlineHours, type CasePriority } from '@/lib/workflow/case-lifecycle'
import { toLifecycleState } from '@/lib/workflow/state-bridge'

/** Less than this share of the SLA window left is "at risk". */
export const AT_RISK_FRACTION = 0.2
/** Claims read per page; the scan is keyset-paged so no run holds every active claim in memory. */
export const SCAN_PAGE_SIZE = 500
/** An upper bound on pages per run so a runaway table cannot make one run unbounded; hitting it is reported as a failure. */
export const MAX_SCAN_PAGES = 400
/** Most alerts written for one organization in one run; the remainder is counted and reported, and is written on the next run. */
export const MAX_ALERTS_PER_ORGANIZATION = 500

export type SlaState = 'ok' | 'at_risk' | 'breached'

export interface ScannedClaim {
  claimId: string
  claimNumber: string | null
  status: string
  priority: string | null
  organizationId: string | null
  assignedTo: string | null
  statusChangedAt?: Date | null
  createdAt: Date | null
}

export interface SlaAssessment {
  state: SlaState
  deadline: Date
  hoursRemaining: number
  totalHours: number
}

export function assessClaim(claim: ScannedClaim, now: Date): SlaAssessment {
  const priority = (claim.priority as CasePriority) || 'medium'
  const totalHours = getSLADeadlineHours(toLifecycleState('claim', claim.status) ?? 'submitted', priority)
  const changedAt = slaClockStart(claim, now).startedAt
  const deadline = new Date(changedAt.getTime() + totalHours * 3_600_000)
  const hoursRemaining = (deadline.getTime() - now.getTime()) / 3_600_000
  const state: SlaState = hoursRemaining <= 0 ? 'breached' : hoursRemaining < totalHours * AT_RISK_FRACTION ? 'at_risk' : 'ok'
  return { state, deadline, hoursRemaining, totalHours }
}

export interface SlaAlert {
  claimId: string
  claimNumber: string | null
  recipient: string
  kind: 'breached' | 'at_risk'
  deadline: Date
  hoursRemaining: number
}

/** One alert per claim, kind and deadline: a claim that moves on gets a new deadline and so a new alert, a repeated run gets none. */
export const alertKey = (alert: Pick<SlaAlert, 'claimId' | 'kind' | 'deadline'>) =>
  `sla:${alert.claimId}:${alert.kind}:${alert.deadline.toISOString()}`

export interface OrganizationTally {
  scanned: number
  compliant: number
  atRisk: number
  breached: number
  unassigned: number
  alerts: SlaAlert[]
}

export const emptyTally = (): OrganizationTally => ({ scanned: 0, compliant: 0, atRisk: 0, breached: 0, unassigned: 0, alerts: [] })

export function tally(into: OrganizationTally, claim: ScannedClaim, assessment: SlaAssessment): void {
  into.scanned += 1
  if (assessment.state === 'breached') into.breached += 1
  else {
    into.compliant += 1
    if (assessment.state === 'at_risk') into.atRisk += 1
  }
  if (assessment.state === 'ok') return
  if (!claim.assignedTo) {
    into.unassigned += 1
    return
  }
  into.alerts.push({
    claimId: claim.claimId,
    claimNumber: claim.claimNumber,
    recipient: claim.assignedTo,
    kind: assessment.state,
    deadline: assessment.deadline,
    hoursRemaining: assessment.hoursRemaining,
  })
}

const label = (alert: SlaAlert) => alert.claimNumber ?? alert.claimId

/**
 * Writes the alerts as inbox rows inside the organization's own context. A unique index over the dedupe key makes the write
 * idempotent (migration 20261103), so a rerun, a retry or two overlapping runs add nothing. Returns how many rows were new.
 */
export async function writeSlaAlerts(tx: RLSTx, organizationId: string, alerts: readonly SlaAlert[]): Promise<number> {
  if (alerts.length === 0) return 0
  const rows = alerts.map((alert) => ({
    userId: alert.recipient,
    organizationId,
    title: alert.kind === 'breached' ? `SLA breached: case ${label(alert)}` : `SLA at risk: case ${label(alert)}`,
    message: alert.kind === 'breached'
      ? `Case ${label(alert)} passed its service-level deadline ${Math.max(0.1, Math.abs(alert.hoursRemaining)).toFixed(1)} hours ago.`
      : `Case ${label(alert)} reaches its service-level deadline in ${alert.hoursRemaining.toFixed(1)} hours.`,
    type: alert.kind === 'breached' ? 'error' : 'warning',
    actionLabel: 'Open case',
    actionUrl: `/dashboard/cases/${encodeURIComponent(alert.claimId)}`,
    data: { origin: 'system:sla-watchdog', dedupeKey: alertKey(alert), claimId: alert.claimId, deadline: alert.deadline.toISOString() },
  }))
  const inserted = await tx.insert(inAppNotifications).values(rows).onConflictDoNothing().returning({ id: inAppNotifications.id })
  return inserted.length
}

