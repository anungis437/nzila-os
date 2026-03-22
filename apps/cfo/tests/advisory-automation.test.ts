/**
 * Tests — Advisory Automation Engine
 *
 * Pure-function tests for the proactive advisory system:
 * threshold evaluation, alert generation, impact estimation,
 * severity sorting, batch scanning, and active-alert filtering.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateClientMetrics,
  scanAllClients,
  alertSummary,
  activeAlerts,
  DEFAULT_ALERT_THRESHOLDS,
  type ClientMetrics,
  type AlertThreshold,
  type AdvisoryAlert,
} from '@/lib/advisory-automation'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function buildMetrics(overrides: Partial<ClientMetrics> = {}): ClientMetrics {
  return {
    clientId: 'c-001',
    clientName: 'Acme Corp',
    cashRunwayDays: 90,
    overdueReceivables: 0,
    overdueReceivablesCount: 0,
    totalReceivables: 50_000,
    daysToNextDeadline: 60,
    nextDeadlineType: 'GST/HST',
    effectiveTaxRate: 0.15,
    optimalTaxRate: 0.15,
    gstBalance: 4_200,
    qboSyncAge: 2,
    ...overrides,
  }
}

/* ── 1. Threshold evaluation ─────────────────────────────────────────────── */

describe('evaluateClientMetrics', () => {
  it('returns empty array when all metrics are healthy', () => {
    const alerts = evaluateClientMetrics(buildMetrics())
    expect(alerts).toEqual([])
  })

  it('triggers critical cash-flow alert when runway < 30 days', () => {
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 20 }))
    const critical = alerts.filter((a) => a.category === 'cash-flow' && a.severity === 'critical')
    expect(critical.length).toBe(1)
    expect(critical[0].title).toBe('Cash runway critically low')
    expect(critical[0].message).toContain('20 days')
  })

  it('triggers high cash-flow alert when runway between 30-60', () => {
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 45 }))
    const high = alerts.filter((a) => a.category === 'cash-flow' && a.severity === 'high')
    expect(high.length).toBe(1)
    expect(high[0].title).toBe('Cash runway declining')
  })

  it('triggers both critical and high alerts when runway < 30', () => {
    // cashRunwayDays < 30 triggers both < 30 (critical) and < 60 (high)
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 15 }))
    const cashAlerts = alerts.filter((a) => a.category === 'cash-flow')
    expect(cashAlerts.length).toBe(2)
  })

  it('triggers receivables alert when overdue > $10k', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ overdueReceivables: 25_000, overdueReceivablesCount: 3 }),
    )
    const recv = alerts.find((a) => a.category === 'receivables')
    expect(recv).toBeDefined()
    expect(recv!.severity).toBe('high')
    expect(recv!.estimatedImpact).toBe(25_000)
    expect(recv!.message).toContain('$25000')
    expect(recv!.message).toContain('3 invoices')
  })

  it('triggers tax deadline critical alert when < 14 days', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ daysToNextDeadline: 7, nextDeadlineType: 'T2 Corporate' }),
    )
    const tax = alerts.filter((a) => a.category === 'tax-deadline' && a.severity === 'critical')
    expect(tax.length).toBe(1)
    expect(tax[0].message).toContain('T2 Corporate')
    expect(tax[0].message).toContain('7 days')
  })

  it('triggers tax optimization alert when effective > optimal + 2%', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ effectiveTaxRate: 0.28, optimalTaxRate: 0.22 }),
    )
    const opt = alerts.find((a) => a.category === 'tax-optimization')
    expect(opt).toBeDefined()
    expect(opt!.severity).toBe('medium')
    expect(opt!.estimatedImpact).toBeGreaterThan(0)
  })

  it('does NOT trigger tax optimization when rates are close', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ effectiveTaxRate: 0.23, optimalTaxRate: 0.22 }),
    )
    const opt = alerts.find((a) => a.category === 'tax-optimization')
    expect(opt).toBeUndefined()
  })

  it('triggers QBO sync stale alert when > 48 hours', () => {
    const alerts = evaluateClientMetrics(buildMetrics({ qboSyncAge: 72 }))
    const compliance = alerts.find((a) => a.category === 'compliance')
    expect(compliance).toBeDefined()
    expect(compliance!.severity).toBe('high')
    expect(compliance!.message).toContain('72')
  })

  it('sorts alerts by severity (critical first)', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({
        cashRunwayDays: 15,
        overdueReceivables: 50_000,
        overdueReceivablesCount: 5,
        qboSyncAge: 72,
      }),
    )
    expect(alerts.length).toBeGreaterThan(2)
    expect(alerts[0].severity).toBe('critical')
  })

  it('accepts custom thresholds', () => {
    const custom: AlertThreshold[] = [
      {
        category: 'cash-flow',
        metric: 'cashRunwayDays',
        operator: 'lt',
        value: 180,
        severity: 'info',
        title: 'Custom alert',
        messageTemplate: 'Custom: {value}',
        actionTemplate: 'Custom action',
      },
    ]
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 90 }), custom)
    expect(alerts.length).toBe(1)
    expect(alerts[0].title).toBe('Custom alert')
  })

  it('populates alert fields correctly', () => {
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 10 }))
    const alert = alerts[0]
    expect(alert.clientId).toBe('c-001')
    expect(alert.clientName).toBe('Acme Corp')
    expect(alert.dismissed).toBe(false)
    expect(alert.createdAt).toBeTruthy()
    expect(alert.id).toMatch(/^alert-c-001-/)
  })
})

/* ── 2. Impact estimation ────────────────────────────────────────────────── */

describe('alert impact estimation', () => {
  it('returns receivable dollar amount as impact', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ overdueReceivables: 42_000, overdueReceivablesCount: 2 }),
    )
    const recv = alerts.find((a) => a.category === 'receivables')
    expect(recv!.estimatedImpact).toBe(42_000)
  })

  it('calculates tax optimization impact based on rate difference', () => {
    const alerts = evaluateClientMetrics(
      buildMetrics({ effectiveTaxRate: 0.30, optimalTaxRate: 0.20 }),
    )
    const opt = alerts.find((a) => a.category === 'tax-optimization')
    expect(opt!.estimatedImpact).toBe(20_000) // 0.10 * 200_000
  })

  it('returns 0 impact for cash-flow alerts', () => {
    const alerts = evaluateClientMetrics(buildMetrics({ cashRunwayDays: 10 }))
    const cf = alerts.find((a) => a.category === 'cash-flow')
    expect(cf!.estimatedImpact).toBe(0)
  })
})

/* ── 3. Batch scanning ───────────────────────────────────────────────────── */

describe('scanAllClients', () => {
  it('aggregates alerts across multiple clients', () => {
    const clients: ClientMetrics[] = [
      buildMetrics({ clientId: 'c-001', cashRunwayDays: 10 }),
      buildMetrics({ clientId: 'c-002', overdueReceivables: 20_000, overdueReceivablesCount: 4 }),
      buildMetrics({ clientId: 'c-003' }), // healthy
    ]
    const alerts = scanAllClients(clients)
    expect(alerts.length).toBeGreaterThanOrEqual(3) // c-001 gets 2 cash-flow + c-002 gets 1 receivables
    // Sorted: critical first
    expect(alerts[0].severity).toBe('critical')
  })

  it('returns empty when all clients healthy', () => {
    const clients = [buildMetrics({ clientId: 'c-001' }), buildMetrics({ clientId: 'c-002' })]
    expect(scanAllClients(clients)).toEqual([])
  })
})

/* ── 4. Alert summary ────────────────────────────────────────────────────── */

describe('alertSummary', () => {
  it('counts alerts by severity', () => {
    const alerts: AdvisoryAlert[] = [
      { severity: 'critical' as const },
      { severity: 'critical' as const },
      { severity: 'high' as const },
      { severity: 'medium' as const },
    ].map((a, i) => ({
      id: `a-${i}`,
      clientId: 'c-1',
      clientName: 'X',
      category: 'cash-flow',
      title: '',
      message: '',
      estimatedImpact: 0,
      suggestedAction: '',
      createdAt: new Date().toISOString(),
      dismissed: false,
      ...a,
    }))

    const summary = alertSummary(alerts)
    expect(summary.critical).toBe(2)
    expect(summary.high).toBe(1)
    expect(summary.medium).toBe(1)
    expect(summary.info).toBe(0)
  })

  it('returns all zeros for empty array', () => {
    const summary = alertSummary([])
    expect(summary).toEqual({ critical: 0, high: 0, medium: 0, info: 0 })
  })
})

/* ── 5. Active alert filtering ───────────────────────────────────────────── */

describe('activeAlerts', () => {
  const base: AdvisoryAlert = {
    id: 'a-1',
    clientId: 'c-1',
    clientName: 'Test',
    category: 'cash-flow',
    severity: 'high',
    title: 'Test',
    message: 'Test',
    estimatedImpact: 0,
    suggestedAction: 'Do something',
    createdAt: new Date().toISOString(),
    dismissed: false,
  }

  it('excludes dismissed alerts', () => {
    const result = activeAlerts([base, { ...base, id: 'a-2', dismissed: true }])
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('a-1')
  })

  it('excludes expired alerts', () => {
    const expired = {
      ...base,
      id: 'a-2',
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    }
    const result = activeAlerts([base, expired])
    expect(result.length).toBe(1)
  })

  it('keeps alerts with future expiry', () => {
    const future = {
      ...base,
      id: 'a-2',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }
    const result = activeAlerts([base, future])
    expect(result.length).toBe(2)
  })

  it('keeps alerts with no expiry', () => {
    expect(activeAlerts([base])).toHaveLength(1)
  })
})

/* ── 6. Default thresholds sanity ────────────────────────────────────────── */

describe('DEFAULT_ALERT_THRESHOLDS', () => {
  it('has at least 5 thresholds', () => {
    expect(DEFAULT_ALERT_THRESHOLDS.length).toBeGreaterThanOrEqual(5)
  })

  it('covers all major categories', () => {
    const categories = new Set(DEFAULT_ALERT_THRESHOLDS.map((t) => t.category))
    expect(categories).toContain('cash-flow')
    expect(categories).toContain('receivables')
    expect(categories).toContain('tax-deadline')
    expect(categories).toContain('tax-optimization')
    expect(categories).toContain('compliance')
  })

  it('has valid operators', () => {
    for (const t of DEFAULT_ALERT_THRESHOLDS) {
      expect(['gt', 'lt', 'eq']).toContain(t.operator)
    }
  })
})
