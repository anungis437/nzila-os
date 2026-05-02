import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildPipelineAlert, evaluatePipelineAlerts, sendPipelineAlert } from './index'

// ---------------------------------------------------------------------------
// buildPipelineAlert
// ---------------------------------------------------------------------------

describe('buildPipelineAlert', () => {
  it('uses a provided createdAt', () => {
    const t = new Date('2026-01-01T00:00:00Z')
    const alert = buildPipelineAlert({
      pipelineName: 'test-pipeline',
      severity: 'info',
      trigger: 'latest_run_failed',
      message: 'test',
      createdAt: t,
    })
    expect(alert.createdAt).toBe(t)
  })

  it('defaults createdAt to now when omitted', () => {
    const before = Date.now()
    const alert = buildPipelineAlert({
      pipelineName: 'test-pipeline',
      severity: 'warning',
      trigger: 'freshness_sla_warning',
      message: 'lag too high',
    })
    expect(alert.createdAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(alert.createdAt.getTime()).toBeLessThanOrEqual(Date.now())
  })
})

// ---------------------------------------------------------------------------
// evaluatePipelineAlerts
// ---------------------------------------------------------------------------

describe('evaluatePipelineAlerts', () => {
  const base = {
    pipelineName: 'decision-aggregates',
    organizationId: 'org-1',
    runId: 'run-1',
  }

  it('returns empty array when no alert conditions are met', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'success',
    })
    expect(alerts).toHaveLength(0)
  })

  it('emits a warning alert for freshness_sla_warning', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'warning',
      freshnessLagMs: 120_000,
      lastRunStatus: 'success',
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.trigger).toBe('freshness_sla_warning')
    expect(alerts[0]!.freshnessLagMs).toBe(120_000)
  })

  it('emits a critical alert for freshness_sla_breach', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'breached',
      freshnessLagMs: 600_000,
      lastRunStatus: 'success',
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('critical')
    expect(alerts[0]!.trigger).toBe('freshness_sla_breach')
  })

  it('emits a critical alert for latest_run_failed', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'failure',
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('critical')
    expect(alerts[0]!.trigger).toBe('latest_run_failed')
  })

  it('emits a critical alert for integrity critical', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'success',
      integritySeverity: 'critical',
      integrityValid: false,
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('critical')
    expect(alerts[0]!.trigger).toBe('aggregate_verification_failed')
  })

  it('emits a warning alert for integrity warning', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'success',
      integritySeverity: 'warning',
      integrityValid: true,
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('warning')
    expect(alerts[0]!.trigger).toBe('aggregate_verification_failed')
  })

  it('emits a critical alert when max retries exceeded', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'success',
      retryAttempt: 3,
      maxAttempts: 3,
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.severity).toBe('critical')
    expect(alerts[0]!.trigger).toBe('repeated_retry_failures')
  })

  it('does not emit retry alert when below max attempts', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'ok',
      lastRunStatus: 'success',
      retryAttempt: 2,
      maxAttempts: 3,
    })
    expect(alerts).toHaveLength(0)
  })

  it('emits multiple alerts when multiple conditions are met', () => {
    const alerts = evaluatePipelineAlerts({
      ...base,
      freshnessStatus: 'breached',
      freshnessLagMs: 900_000,
      lastRunStatus: 'failure',
    })
    expect(alerts.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// sendPipelineAlert
// ---------------------------------------------------------------------------

describe('sendPipelineAlert', () => {
  beforeEach(() => {
    vi.stubEnv('CI', 'true')
    vi.stubEnv('PIPELINE_ALERT_CHANNELS', '')
  })

  it('returns { delivered: false } in CI with no channel override', async () => {
    vi.stubEnv('CI', 'true')
    vi.stubEnv('PIPELINE_ALERT_CHANNELS', '')
    const alert = buildPipelineAlert({
      pipelineName: 'p1',
      severity: 'info',
      trigger: 'latest_run_failed',
      message: 'test send',
    })
    const result = await sendPipelineAlert(alert)
    expect(result.delivered).toBe(false)
  })
})
