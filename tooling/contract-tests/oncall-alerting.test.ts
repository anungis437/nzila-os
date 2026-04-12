/**
 * On-Call & Alert Routing Contract Tests
 *
 * Validates that the operational alerting configuration is complete:
 *   - Every alert has a runbook reference
 *   - Escalation policies cover all severity levels
 *   - PagerDuty integration is configured for P1/P2
 *   - Alert routing covers all deployed services
 *
 * @invariant ONCALL_001 — Every alert must reference a runbook
 * @invariant ONCALL_002 — Escalation policies for all severity levels
 * @invariant ONCALL_003 — P1 alerts must route to PagerDuty
 * @invariant ONCALL_004 — All deployed apps must have at least one alert rule
 */
import { describe, it, expect } from 'vitest'
import {
  ALERT_RULES,
  ESCALATION_POLICIES,
  validateAlertConfig,
} from '../../ops/oncall/alert-routing'

/** Apps/services that are deployed and should have alerts */
const DEPLOYED_APPS = [
  'console',
  'web',
  'partners',
]

describe('ONCALL_001 — Every alert references a runbook', () => {
  it('should have a non-empty runbookRef for every alert', () => {
    const missing = ALERT_RULES.filter((r) => !r.runbookRef || r.runbookRef.trim() === '')
    expect(
      missing.map((r) => r.id),
      `Alerts missing runbook: ${missing.map((r) => r.id).join(', ')}`,
    ).toHaveLength(0)
  })
})

describe('ONCALL_002 — Escalation policies for all severity levels', () => {
  it('should define escalation policies for P1, P2, P3, P4', () => {
    const severities = ['P1', 'P2', 'P3', 'P4'] as const
    for (const sev of severities) {
      const policy = ESCALATION_POLICIES.find((p) => p.severity === sev)
      expect(policy, `Missing escalation policy for ${sev}`).toBeDefined()
      expect(
        policy!.steps.length,
        `${sev} must have at least one escalation step`,
      ).toBeGreaterThan(0)
    }
  })

  it('should have response SLAs within acceptable ranges', () => {
    const p1 = ESCALATION_POLICIES.find((p) => p.severity === 'P1')!
    expect(
      p1.initialResponseMinutes,
      'P1 response SLA must be ≤ 15 minutes',
    ).toBeLessThanOrEqual(15)

    const p2 = ESCALATION_POLICIES.find((p) => p.severity === 'P2')!
    expect(
      p2.initialResponseMinutes,
      'P2 response SLA must be ≤ 60 minutes',
    ).toBeLessThanOrEqual(60)
  })
})

describe('ONCALL_003 — P1 alerts route to PagerDuty', () => {
  it('should send all P1 alerts to pagerduty channel', () => {
    const p1Alerts = ALERT_RULES.filter((r) => r.severity === 'P1')
    expect(p1Alerts.length, 'Should have at least one P1 alert').toBeGreaterThan(0)

    const noPager = p1Alerts.filter((r) => !r.channels.includes('pagerduty'))
    expect(
      noPager.map((r) => r.id),
      `P1 alerts without PagerDuty: ${noPager.map((r) => `${r.id} (${r.name})`).join(', ')}`,
    ).toHaveLength(0)
  })
})

describe('ONCALL_004 — Alert coverage for deployed services', () => {
  it('should have at least one alert for each deployed app', () => {
    const alertedServices = new Set(ALERT_RULES.map((r) => r.service))
    const uncovered = DEPLOYED_APPS.filter((app) => !alertedServices.has(app))

    expect(
      uncovered,
      `Deployed apps without alert rules: ${uncovered.join(', ')}`,
    ).toHaveLength(0)
  })
})

describe('Alert config validation', () => {
  it('should pass internal validation', () => {
    const result = validateAlertConfig()
    expect(
      result.errors,
      `Alert config errors: ${result.errors.join('\n')}`,
    ).toHaveLength(0)
  })

  it('should have no duplicate alert IDs', () => {
    const ids = ALERT_RULES.map((r) => r.id)
    const unique = new Set(ids)
    expect(ids.length, 'Duplicate alert IDs detected').toBe(unique.size)
  })
})
