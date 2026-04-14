import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { __test__ as pilotMetricsTest } from '../../packages/platform-pilot-metrics/src/service'

const ROOT = resolve(__dirname, '../..')

const UE_CASE_ROUTE_PATH = resolve(ROOT, 'apps/union-eyes/app/api/cases/route.ts')
const UE_WORKFLOW_ROUTE_PATH = resolve(ROOT, 'apps/union-eyes/app/api/workflow/transition/route.ts')
const UE_WATCHDOG_ROUTE_PATH = resolve(ROOT, 'apps/union-eyes/app/api/cron/sla-watchdog/route.ts')

const ZONGA_EVENT_ACTIONS_PATH = resolve(ROOT, 'apps/zonga/lib/actions/event-actions.ts')
const ZONGA_REVENUE_ACTIONS_PATH = resolve(ROOT, 'apps/zonga/lib/actions/revenue-actions.ts')
const ZONGA_STREAM_ROUTE_PATH = resolve(ROOT, 'apps/zonga/app/api/stream/[assetId]/route.ts')
const ZONGA_ANALYTICS_ROUTE_PATH = resolve(ROOT, 'apps/zonga/app/api/analytics/route.ts')
const ZONGA_CHECKIN_SERVICE_PATH = resolve(ROOT, 'apps/zonga/features/events/checkin-service.ts')
const ZONGA_PAYOUT_ACTIONS_PATH = resolve(ROOT, 'apps/zonga/lib/actions/payout-actions.ts')

const CP_LIST_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/route.ts')
const CP_DETAIL_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/route.ts')
const CP_HEALTH_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/health/route.ts')
const CP_EXPORT_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/export/route.ts')
const CP_ALERTS_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/alerts/route.ts')
const CP_ALERT_RULES_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/alert-rules/route.ts')
const CP_ESCALATIONS_ROUTE_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/[pilotId]/escalations/route.ts')
const CP_ALERT_INBOX_API_PATH = resolve(ROOT, 'apps/control-plane/app/api/control-plane/pilot-metrics/alerts/route.ts')
const CP_SERVER_ADAPTER_PATH = resolve(ROOT, 'apps/control-plane/server/pilot-metrics-data.ts')
const CP_PILOTS_PAGE_PATH = resolve(ROOT, 'apps/control-plane/app/(dashboard)/pilots/page.tsx')
const CP_ALERT_INBOX_PAGE_PATH = resolve(ROOT, 'apps/control-plane/app/(dashboard)/pilots/alerts/page.tsx')

const UE_CASE_ROUTE = existsSync(UE_CASE_ROUTE_PATH) ? readFileSync(UE_CASE_ROUTE_PATH, 'utf-8') : ''
const UE_WORKFLOW_ROUTE = existsSync(UE_WORKFLOW_ROUTE_PATH) ? readFileSync(UE_WORKFLOW_ROUTE_PATH, 'utf-8') : ''
const UE_WATCHDOG_ROUTE = existsSync(UE_WATCHDOG_ROUTE_PATH) ? readFileSync(UE_WATCHDOG_ROUTE_PATH, 'utf-8') : ''

const ZONGA_EVENT_ACTIONS = existsSync(ZONGA_EVENT_ACTIONS_PATH) ? readFileSync(ZONGA_EVENT_ACTIONS_PATH, 'utf-8') : ''
const ZONGA_REVENUE_ACTIONS = existsSync(ZONGA_REVENUE_ACTIONS_PATH) ? readFileSync(ZONGA_REVENUE_ACTIONS_PATH, 'utf-8') : ''
const ZONGA_STREAM_ROUTE = existsSync(ZONGA_STREAM_ROUTE_PATH) ? readFileSync(ZONGA_STREAM_ROUTE_PATH, 'utf-8') : ''
const ZONGA_ANALYTICS_ROUTE = existsSync(ZONGA_ANALYTICS_ROUTE_PATH) ? readFileSync(ZONGA_ANALYTICS_ROUTE_PATH, 'utf-8') : ''
const ZONGA_CHECKIN_SERVICE = existsSync(ZONGA_CHECKIN_SERVICE_PATH) ? readFileSync(ZONGA_CHECKIN_SERVICE_PATH, 'utf-8') : ''
const ZONGA_PAYOUT_ACTIONS = existsSync(ZONGA_PAYOUT_ACTIONS_PATH) ? readFileSync(ZONGA_PAYOUT_ACTIONS_PATH, 'utf-8') : ''

const CP_LIST_ROUTE = existsSync(CP_LIST_ROUTE_PATH) ? readFileSync(CP_LIST_ROUTE_PATH, 'utf-8') : ''
const CP_DETAIL_ROUTE = existsSync(CP_DETAIL_ROUTE_PATH) ? readFileSync(CP_DETAIL_ROUTE_PATH, 'utf-8') : ''
const CP_HEALTH_ROUTE = existsSync(CP_HEALTH_ROUTE_PATH) ? readFileSync(CP_HEALTH_ROUTE_PATH, 'utf-8') : ''
const CP_EXPORT_ROUTE = existsSync(CP_EXPORT_ROUTE_PATH) ? readFileSync(CP_EXPORT_ROUTE_PATH, 'utf-8') : ''
const CP_ALERTS_ROUTE = existsSync(CP_ALERTS_ROUTE_PATH) ? readFileSync(CP_ALERTS_ROUTE_PATH, 'utf-8') : ''
const CP_ALERT_RULES_ROUTE = existsSync(CP_ALERT_RULES_ROUTE_PATH) ? readFileSync(CP_ALERT_RULES_ROUTE_PATH, 'utf-8') : ''
const CP_ESCALATIONS_ROUTE = existsSync(CP_ESCALATIONS_ROUTE_PATH) ? readFileSync(CP_ESCALATIONS_ROUTE_PATH, 'utf-8') : ''
const CP_ALERT_INBOX_API = existsSync(CP_ALERT_INBOX_API_PATH) ? readFileSync(CP_ALERT_INBOX_API_PATH, 'utf-8') : ''
const CP_SERVER_ADAPTER = existsSync(CP_SERVER_ADAPTER_PATH) ? readFileSync(CP_SERVER_ADAPTER_PATH, 'utf-8') : ''
const CP_PILOTS_PAGE = existsSync(CP_PILOTS_PAGE_PATH) ? readFileSync(CP_PILOTS_PAGE_PATH, 'utf-8') : ''
const CP_ALERT_INBOX_PAGE = existsSync(CP_ALERT_INBOX_PAGE_PATH) ? readFileSync(CP_ALERT_INBOX_PAGE_PATH, 'utf-8') : ''

describe('Pilot Metrics E2E Proof Wiring', () => {
  it('UE flow produces defensible rollup KPI outputs from real metric inputs', () => {
    const aggregated = pilotMetricsTest.aggregateMetricEvents([
      { metricName: 'cases_created', valueNumeric: 1, valueJson: null, appScope: 'union-eyes' },
      { metricName: 'cases_acknowledged', valueNumeric: 1, valueJson: null, appScope: 'union-eyes' },
      {
        metricName: 'avg_time_to_first_response',
        valueNumeric: 45,
        valueJson: { numeratorMinutes: 45, denominator: 1 },
        appScope: 'union-eyes',
      },
      {
        metricName: 'avg_time_to_resolution',
        valueNumeric: 18,
        valueJson: { numeratorHours: 18, denominator: 1 },
        appScope: 'union-eyes',
      },
      { metricName: 'workflow_transition_success_rate', valueNumeric: 1, valueJson: null, appScope: 'union-eyes' },
      { metricName: 'workflow_transition_success_rate', valueNumeric: 0, valueJson: null, appScope: 'union-eyes' },
      {
        metricName: 'sla_compliance_rate',
        valueNumeric: 0,
        valueJson: { compliantCount: 4, totalScanned: 5 },
        appScope: 'union-eyes',
      },
    ])

    expect(aggregated.get('cases_created')?.valueNumeric).toBe(1)
    expect(aggregated.get('cases_acknowledged')?.valueNumeric).toBe(1)
    expect(aggregated.get('avg_time_to_first_response')?.valueNumeric).toBe(45)
    expect(aggregated.get('avg_time_to_resolution')?.valueNumeric).toBe(18)
    expect(aggregated.get('workflow_transition_success_rate')?.valueNumeric).toBe(50)
    expect(aggregated.get('sla_compliance_rate')?.valueNumeric).toBe(80)
  })

  it('Zonga flow produces defensible engagement and monetization KPI outputs', () => {
    const aggregated = pilotMetricsTest.aggregateMetricEvents([
      { metricName: 'events_created', valueNumeric: 1, valueJson: null, appScope: 'zonga' },
      { metricName: 'tickets_sold', valueNumeric: 3, valueJson: null, appScope: 'zonga' },
      { metricName: 'attendee_checkins', valueNumeric: 2, valueJson: null, appScope: 'zonga' },
      { metricName: 'stream_starts', valueNumeric: 3, valueJson: null, appScope: 'zonga' },
      { metricName: 'stream_watch_minutes', valueNumeric: 24, valueJson: { denominator: 1 }, appScope: 'zonga' },
      { metricName: 'stream_watch_minutes', valueNumeric: 12, valueJson: { denominator: 1 }, appScope: 'zonga' },
      { metricName: 'avg_watch_time', valueNumeric: 24, valueJson: { denominator: 1 }, appScope: 'zonga' },
      { metricName: 'avg_watch_time', valueNumeric: 12, valueJson: { denominator: 1 }, appScope: 'zonga' },
      { metricName: 'replay_views', valueNumeric: 1, valueJson: null, appScope: 'zonga' },
      { metricName: 'platform_fee_revenue', valueNumeric: 7.5, valueJson: null, appScope: 'zonga' },
      { metricName: 'creator_payouts', valueNumeric: 30, valueJson: null, appScope: 'zonga' },
      { metricName: 'payout_volume', valueNumeric: 30, valueJson: null, appScope: 'zonga' },
    ])

    expect(aggregated.get('tickets_sold')?.valueNumeric).toBe(3)
    expect(aggregated.get('attendee_checkins')?.valueNumeric).toBe(2)
    expect(aggregated.get('stream_starts')?.valueNumeric).toBe(3)
    expect(aggregated.get('stream_watch_minutes')?.valueNumeric).toBe(36)
    expect(aggregated.get('avg_watch_time')?.valueNumeric).toBe(18)
    expect(aggregated.get('replay_views')?.valueNumeric).toBe(1)
    expect(aggregated.get('platform_fee_revenue')?.valueNumeric).toBe(7.5)
    expect(aggregated.get('creator_payouts')?.valueNumeric).toBe(30)
  })

  it('UE flow is wired from case/workflow actions into pilot metric inputs', () => {
    const caseRoute = UE_CASE_ROUTE
    const workflowRoute = UE_WORKFLOW_ROUTE
    const watchdogRoute = UE_WATCHDOG_ROUTE

    expect(caseRoute.includes('recordUnionEyesCaseCreated')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesCaseAcknowledged')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesCaseResolved')).toBe(true)
    expect(workflowRoute.includes('recordUnionEyesWorkflowTransition')).toBe(true)
    expect(watchdogRoute.includes('recordUnionEyesSlaWatchdog')).toBe(true)
    expect(watchdogRoute.includes('recordUnionEyesSlaCompliance')).toBe(true)
  })

  it('Zonga flow is wired from event/revenue/playback/checkin paths into pilot metrics', () => {
    const eventActions = ZONGA_EVENT_ACTIONS
    const revenueActions = ZONGA_REVENUE_ACTIONS
    const streamRoute = ZONGA_STREAM_ROUTE
    const analyticsRoute = ZONGA_ANALYTICS_ROUTE
    const checkinService = ZONGA_CHECKIN_SERVICE
    const payoutActions = ZONGA_PAYOUT_ACTIONS

    expect(eventActions.includes('recordZongaEventCreated')).toBe(true)
    expect(eventActions.includes('recordZongaTicketSold')).toBe(true)
    expect(revenueActions.includes('recordZongaRevenueEvent')).toBe(true)
    expect(revenueActions.includes('recordZongaPlatformFeeRevenue')).toBe(true)
    expect(streamRoute.includes('recordZongaStreamStart')).toBe(true)
    expect(streamRoute.includes('recordZongaReplayView')).toBe(true)
    expect(analyticsRoute.includes('recordZongaPlaybackWatch')).toBe(true)
    expect(checkinService.includes('recordZongaAttendeeCheckin')).toBe(true)
    expect(payoutActions.includes('recordZongaCreatorPayout')).toBe(true)
  })

  it('Control Plane pilot APIs and proof pages read live pilot-metrics adapters', () => {
    const listRoute = CP_LIST_ROUTE
    const detailRoute = CP_DETAIL_ROUTE
    const healthRoute = CP_HEALTH_ROUTE
    const exportRoute = CP_EXPORT_ROUTE
    const alertsRoute = CP_ALERTS_ROUTE
    const rulesRoute = CP_ALERT_RULES_ROUTE
    const escalationsRoute = CP_ESCALATIONS_ROUTE
    const inboxApiRoute = CP_ALERT_INBOX_API
    const serverAdapter = CP_SERVER_ADAPTER
    const pilotsPage = CP_PILOTS_PAGE
    const inboxPage = CP_ALERT_INBOX_PAGE

    expect(listRoute.includes('listPilotMetricsPilots')).toBe(true)
    expect(detailRoute.includes('getPilotDetail')).toBe(true)
    expect(healthRoute.includes('recomputePilotHealth')).toBe(true)
    expect(exportRoute.includes('exportPilot')).toBe(true)
    expect(alertsRoute.includes('acknowledge')).toBe(true)
    expect(alertsRoute.includes('resolve')).toBe(true)
    expect(alertsRoute.includes('escalate')).toBe(true)
    expect(rulesRoute.includes('savePilotAlertRule')).toBe(true)
    expect(escalationsRoute.includes('savePilotAlertEscalation')).toBe(true)
    expect(inboxApiRoute.includes('getAlertInbox')).toBe(true)
    expect(serverAdapter.includes('computePilotRollups')).toBe(true)
    expect(serverAdapter.includes('computePilotHealthScore')).toBe(true)
    expect(serverAdapter.includes('computeAlertOpsMetrics')).toBe(true)
    expect(serverAdapter.includes('await computePilotRollups(orgId, pilotId, \'day\')')).toBe(true)
    expect(pilotsPage.includes('getPilotDashboard')).toBe(true)
    expect(inboxPage.includes('Active incidents')).toBe(true)
  })
})
