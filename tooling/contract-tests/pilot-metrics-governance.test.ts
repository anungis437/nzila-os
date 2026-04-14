import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(relPath: string): string {
  const abs = resolve(ROOT, relPath)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

describe('Pilot Metrics Governance Contracts', () => {
  it('pilot metrics API routes enforce auth', () => {
    const route = read('apps/control-plane/app/api/control-plane/pilot-metrics/route.ts')
    const alertsRoute = read('apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/alerts/route.ts')
    expect(route.includes('requireApiAuth')).toBe(true)
    expect(alertsRoute.includes('requireApiAuth')).toBe(true)
  })

  it('pilot metrics service is org and pilot scoped', () => {
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(service.includes('org_id')).toBe(true)
    expect(service.includes('pilot_id')).toBe(true)
  })

  it('pilot metrics ingestion writes audit trail', () => {
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(service.includes("INSERT INTO audit_log")).toBe(true)
    expect(service.includes('pilot.metric.recorded')).toBe(true)
    expect(service.includes('pilot.alert.created')).toBe(true)
    expect(service.includes('pilot.alert.${nextState}')).toBe(true)
    expect(service.includes('pilot.alert.escalated')).toBe(true)
    expect(service.includes('requires traceId')).toBe(true)
    expect(service.includes('requires actorId or systemActorId')).toBe(true)
  })

  it('pilot alerting supports configurable rules and escalations per pilot', () => {
    const schema = read('packages/db/src/schema/pilot-metrics.ts')
    const migration = read('packages/db/drizzle/0010_pilot_alerting_hardening.sql')
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(schema.includes('pilotAlertRules')).toBe(true)
    expect(schema.includes('pilotAlertEscalations')).toBe(true)
    expect(migration.includes('pilot_alert_rules')).toBe(true)
    expect(migration.includes('pilot_alert_escalations')).toBe(true)
    expect(service.includes('defaultRulesByPilotType')).toBe(true)
    expect(service.includes('upsertPilotAlertRule')).toBe(true)
  })

  it('pilot alerting deduplicates and correlates incidents', () => {
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(service.includes('occurrence_count = occurrence_count + 1')).toBe(true)
    expect(service.includes('dedup_key')).toBe(true)
    expect(service.includes('correlation_id')).toBe(true)
    expect(service.includes('computeCorrelationId')).toBe(true)
  })

  it('pilot alerting enforces anti-noise and escalation behavior', () => {
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(service.includes('cooldownMinutes')).toBe(true)
    expect(service.includes('ruleType === \'rate\'')).toBe(true)
    expect(service.includes('ruleType === \'inactivity\'')).toBe(true)
    expect(service.includes('ruleType === \'anomaly\'')).toBe(true)
    expect(service.includes('runEscalationSweep')).toBe(true)
    expect(service.includes('webhookNotifier')).toBe(true)
  })

  it('pilot metrics ingestion enforces org/pilot consistency checks', () => {
    const service = read('packages/platform-pilot-metrics/src/service.ts')
    expect(service.includes('orgId and pilotId mismatch')).toBe(true)
    expect(service.includes('FROM pilot_definitions')).toBe(true)
  })

  it('control-plane pilot metrics paths do not use seed/demo fallback', () => {
    const server = read('apps/control-plane/server/pilot-metrics-data.ts').toLowerCase()
    expect(server.includes('seed')).toBe(false)
    expect(server.includes('fallback')).toBe(false)
    expect(server.includes('demo')).toBe(false)
  })

  it('zonga revenue pilot metrics are emitted from canonical revenue action path', () => {
    const revenue = read('apps/zonga/lib/actions/revenue-actions.ts')
    expect(revenue.includes('recordZongaRevenueEvent')).toBe(true)
    expect(revenue.includes('recordZongaPlatformFeeRevenue')).toBe(true)
  })

  it('union-eyes workflow transition emits pilot workflow metrics', () => {
    const workflowRoute = read('apps/union-eyes/app/api/workflow/transition/route.ts')
    expect(workflowRoute.includes('recordUnionEyesWorkflowTransition')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesCaseAcknowledged')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesCaseResolved')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesWorkflowTransitionFailure')).toBe(true)
  })

  it('union-eyes SLA watchdog emits compliance denominator inputs', () => {
    const watchdog = read('apps/union-eyes/app/api/cron/sla-watchdog/route.ts')
    expect(watchdog.includes('recordUnionEyesSlaCompliance')).toBe(true)
    expect(watchdog.includes('scanned')).toBe(true)
    expect(watchdog.includes('compliant')).toBe(true)
  })

  it('zonga real-time paths emit watch and replay metrics', () => {
    const streamRoute = read('apps/zonga/app/api/stream/[assetId]/route.ts')
    const analyticsRoute = read('apps/zonga/app/api/analytics/route.ts')
    expect(streamRoute.includes('recordZongaReplayView')).toBe(true)
    expect(analyticsRoute.includes('recordZongaPlaybackWatch')).toBe(true)
  })

  it('pilot proof overview page does not depend on seed-backed deal-engine pilots', () => {
    const pilotsPage = read('apps/control-plane/app/(dashboard)/pilots/page.tsx')
    expect(pilotsPage.includes('getPilotDashboard')).toBe(true)
    expect(pilotsPage.includes('getPilots')).toBe(false)
    expect(pilotsPage.includes('deal-engine-data')).toBe(false)
  })

  it('control-plane pilot pages include explicit empty states', () => {
    const healthPage = read('apps/control-plane/app/(dashboard)/pilots/health/page.tsx')
    const reportsPage = read('apps/control-plane/app/(dashboard)/pilots/reports/page.tsx')
    expect(healthPage.includes('EmptyState')).toBe(true)
    expect(reportsPage.includes('EmptyState')).toBe(true)
  })
})
