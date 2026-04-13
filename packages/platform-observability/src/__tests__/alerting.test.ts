import { describe, it, expect, vi } from 'vitest'
import {
  PLATFORM_ALERT_RULES,
  fireAlert,
  type AlertEvent,
} from '../alerting'

describe('alerting', () => {
  describe('PLATFORM_ALERT_RULES', () => {
    it('defines rules for all critical alert categories', () => {
      const categories = new Set(PLATFORM_ALERT_RULES.map((r) => r.category))
      expect(categories).toContain('service_downtime')
      expect(categories).toContain('latency_spike')
      expect(categories).toContain('integration_failure')
      expect(categories).toContain('queue_backlog')
      expect(categories).toContain('job_failure_burst')
      expect(categories).toContain('ai_safety_flag')
      expect(categories).toContain('error_budget_burn')
    })

    it('all rules have valid structure', () => {
      for (const rule of PLATFORM_ALERT_RULES) {
        expect(rule.id).toBeTruthy()
        expect(rule.name).toBeTruthy()
        expect(rule.description).toBeTruthy()
        expect(rule.thresholdValue).toBeGreaterThan(0)
        expect(rule.windowMinutes).toBeGreaterThan(0)
        expect(rule.actions.length).toBeGreaterThan(0)
      }
    })

    it('critical alerts have slack action', () => {
      const critical = PLATFORM_ALERT_RULES.filter((r) => r.severity === 'critical')
      expect(critical.length).toBeGreaterThan(0)
      for (const rule of critical) {
        const hasSlack = rule.actions.some((a) => a.type === 'slack')
        expect(hasSlack).toBe(true)
      }
    })
  })

  describe('fireAlert', () => {
    it('fires an alert event', () => {
      const rule = PLATFORM_ALERT_RULES[0]!
      const events: AlertEvent[] = []
      const sink = (event: AlertEvent) => events.push(event)

      const event = fireAlert(rule, 'console', 1, {}, sink)
      expect(event.ruleId).toBe(rule.id)
      expect(event.severity).toBe(rule.severity)
      expect(event.service).toBe('console')
      expect(event.currentValue).toBe(1)
      expect(event.threshold).toBe(rule.thresholdValue)
      expect(events).toHaveLength(1)
    })

    it('includes metadata in event', () => {
      const rule = PLATFORM_ALERT_RULES[1]!
      const events: AlertEvent[] = []
      const sink = (event: AlertEvent) => events.push(event)

      const event = fireAlert(rule, 'partners', 500, { endpoint: '/api/users' }, sink)
      expect(event.metadata).toEqual({ endpoint: '/api/users' })
    })

    it('uses default sink for critical, warning, and info severities', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      fireAlert(PLATFORM_ALERT_RULES.find((r) => r.severity === 'critical')!, 'console', 1)
      fireAlert(PLATFORM_ALERT_RULES.find((r) => r.severity === 'warning')!, 'console', 1)
      fireAlert(
        {
          ...PLATFORM_ALERT_RULES[0]!,
          id: 'alert-info-test',
          severity: 'info',
        },
        'console',
        1,
      )

      expect(writeSpy).toHaveBeenCalled()
      writeSpy.mockRestore()
    })
  })
})
