/**
 * Task scheduling primitives.
 *
 * Pure helpers for prioritising remediation work derived from compliance
 * risks. Higher priority = sooner. Deterministic — no clock, no randomness.
 */

import type { RiskRegisterSeverity } from '../risks/index'

export type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3'

const SEVERITY_TO_PRIORITY: Record<RiskRegisterSeverity, TaskPriority> = {
  critical: 'p0',
  high: 'p1',
  medium: 'p2',
  low: 'p3',
}

export function priorityForSeverity(severity: RiskRegisterSeverity): TaskPriority {
  return SEVERITY_TO_PRIORITY[severity]
}

/**
 * Compute an SLA deadline (ISO string) given a base date + priority.
 * Caller passes `now` to keep the function pure / testable.
 *
 *   p0 → 24h
 *   p1 → 72h
 *   p2 →  7 days
 *   p3 → 30 days
 */
export function slaDeadlineFor(priority: TaskPriority, now: Date): string {
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR

  const offsetMs =
    priority === 'p0' ? 24 * HOUR
      : priority === 'p1' ? 72 * HOUR
      : priority === 'p2' ? 7 * DAY
      : 30 * DAY

  return new Date(now.getTime() + offsetMs).toISOString()
}

export interface TaskSeed {
  /** Stable id derived from the source risk so seeds dedupe. */
  riskId: string
  title: string
  severity: RiskRegisterSeverity
}

export interface ScheduledTask {
  riskId: string
  title: string
  priority: TaskPriority
  dueAt: string
}

export function scheduleFromRisk(seed: TaskSeed, now: Date): ScheduledTask {
  const priority = priorityForSeverity(seed.severity)
  return {
    riskId: seed.riskId,
    title: seed.title,
    priority,
    dueAt: slaDeadlineFor(priority, now),
  }
}
