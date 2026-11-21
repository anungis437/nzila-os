import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const RELIABILITY_AUDIT = path.join(ROOT, 'reports', 'sre-reliability-audit.json')
const ALERT_DRY_RUN = path.join(ROOT, 'reports', 'sre-alert-routing-dry-run.json')
const SYNTHETIC_DRY_RUN = path.join(ROOT, 'reports', 'sre-synthetic-dry-run.json')
const COST_FILE = path.join(ROOT, 'ops', 'outputs', 'cost-allocation.json')
const CI_RUNS = path.join(ROOT, 'reports', 'runtime', 'ci-runs.jsonl')
const DORA_FILE = path.join(ROOT, 'ops', 'outputs', 'dora-metrics.json')
const OUT_JSON = path.join(ROOT, 'reports', 'sre-executive-dashboard.json')
const OUT_MD = path.join(ROOT, 'docs', 'categories', 'platform-and-operations', 'ops', 'sre', 'executive-reliability-dashboard.md')

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export interface CiRunRecord {
  conclusion?: string
  repository?: string | null
  runId?: string | null
  runAttempt?: number | null
  completedAt?: string
  bootstrapEvidence?: boolean
}

export interface DoraSnapshot {
  collected_at?: string
  metrics?: {
    mttr?: { value?: number | null; source?: string; note?: string | null }
    incidents_last_30d?: { value?: number | null; source?: string }
  }
}

function readJsonl(filePath: string): CiRunRecord[] {
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    .flatMap((line) => {
      try { return [JSON.parse(line) as CiRunRecord] } catch { return [] }
    })
}

export function summarizeRuntimeSignals(ciRuns: CiRunRecord[], dora: DoraSnapshot, now = new Date()) {
  const windowDays = 30
  const since = now.getTime() - windowDays * 86_400_000
  const inWindow = (stamp: string | undefined) => {
    const ms = Date.parse(stamp ?? '')
    return Number.isFinite(ms) && ms >= since && ms <= now.getTime()
  }
  const validRuns = new Map<string, CiRunRecord>()
  const contradictory = new Set<string>()
  for (const run of ciRuns) {
    if (run.bootstrapEvidence || !run.repository || !run.runId ||
      !Number.isInteger(run.runAttempt) || (run.runAttempt ?? 0) < 1 ||
      !inWindow(run.completedAt) ||
      !['success', 'failure', 'cancelled', 'timed_out', 'neutral'].includes(run.conclusion ?? '')) continue
    const key = `${run.repository}/${run.runId}/${run.runAttempt}`
    const previous = validRuns.get(key)
    if (previous && previous.conclusion !== run.conclusion) contradictory.add(key)
    validRuns.set(key, run)
  }
  for (const key of contradictory) validRuns.delete(key)
  const runs = [...validRuns.values()]
  const runtimeIncidentSources = new Set([
    'ops/outputs/incident-events.jsonl',
    'reports/runtime/incident-events.jsonl',
    'reports/runtime/incidents.jsonl',
    ...(process.env.DORA_INCIDENT_FEED_PATH ? [process.env.DORA_INCIDENT_FEED_PATH] : []),
  ])
  const mttr = dora.metrics?.mttr
  const incidents = dora.metrics?.incidents_last_30d
  const freshDora = inWindow(dora.collected_at)
  const validValue = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  return {
    windowDays,
    ciWorkflowCount: runs.length,
    ciWorkflowSuccessRatePct: runs.length > 0
      ? Number(((runs.filter((run) => run.conclusion === 'success').length / runs.length) * 100).toFixed(2))
      : null,
    ciFailedWorkflowCount: runs.filter((run) => run.conclusion === 'failure').length,
    contradictoryCiRecords: contradictory.size,
    // Generic CI conclusions establish neither deployment outcomes nor rollbacks.
    deploySuccessRatePct: null,
    rollbackCount: null,
    mttrHours: freshDora && mttr && runtimeIncidentSources.has(mttr.source ?? '') &&
      !mttr.note && validValue(mttr.value) ? mttr.value : null,
    incidentsLast30Days: freshDora && incidents && runtimeIncidentSources.has(incidents.source ?? '') &&
      validValue(incidents.value) ? incidents.value : null,
    incidentSnapshotAt: dora.collected_at ?? null,
  }
}

function main() {
  const audit = readJson(RELIABILITY_AUDIT, {
    scores: { reliability: 0, observability: 0, incidentReadiness: 0, costGovernance: 0, mttrReadiness: 0 },
    missingHealthEndpointContracts: [] as Array<{ app: string }>,
  })
  const alert = readJson(ALERT_DRY_RUN, { passed: false, ownerlessAlerts: [] as string[] })
  const synthetic = readJson(SYNTHETIC_DRY_RUN, { targetCount: 0 })
  const cost = readJson(COST_FILE, {
    total_monthly_cost_usd: null, unresolved_app_count: null, collected_at: null, period: null,
  })
  const signals = summarizeRuntimeSignals(readJsonl(CI_RUNS), readJson<DoraSnapshot>(DORA_FILE, {}))
  const openActionItems = [
    'Verify live synthetic probes; configured targets alone do not establish endpoint availability.',
    'Verify live alert delivery; routing configuration alone does not establish delivery.',
    'Backfill actual deployment outcomes and rollback events; CI workflow conclusions are not deployment or rollback receipts.',
  ]
  if (signals.mttrHours === null || signals.incidentsLast30Days === null) {
    openActionItems.push('Integrate a current runtime incident feed; vulnerability remediation metrics do not establish incident MTTR or incident counts.')
  }
  const dashboard = {
    generatedAt: new Date().toISOString(),
    scope: 'SOURCE_CONFIGURATION_AND_REFERENCED_TELEMETRY_ONLY',
    portfolioUptimePct: null,
    incidentsThisMonth: null,
    appsBreachingSlo: null,
    appsMissingEndpointContracts: audit.missingHealthEndpointContracts.map((app) => app.app),
    ...signals,
    costTrend: {
      monthlyCostUsd: cost.total_monthly_cost_usd,
      unresolvedCostApps: cost.unresolved_app_count,
      observedAt: cost.collected_at ?? null,
      period: cost.period ?? null,
      note: 'Referenced cost snapshot; not a current live measurement.',
    },
    topRiskApps: audit.missingHealthEndpointContracts.map((app) => app.app).slice(0, 5),
    openActionItems,
    scoreSummary: audit.scores,
    alertRoutingConfigured: alert.passed,
    alertRoutingReady: null,
    liveAlertDeliveryVerified: false,
    syntheticConfiguredTargets: synthetic.targetCount,
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(dashboard, null, 2), 'utf8')
  const md = `# Executive Reliability Dashboard

Generated: ${dashboard.generatedAt}

Source and configuration checks do not establish live availability, alert delivery, SLO attainment, deployment success or recovery.

## Source and Configuration Scores (0-10)

- Reliability: ${dashboard.scoreSummary.reliability}
- Observability: ${dashboard.scoreSummary.observability}
- Incident procedures: ${dashboard.scoreSummary.incidentReadiness}
- Cost governance: ${dashboard.scoreSummary.costGovernance}
- Recovery procedures: ${dashboard.scoreSummary.mttrReadiness}

## Observed Inputs

- Apps missing endpoint source contracts: ${dashboard.appsMissingEndpointContracts.length}
- Synthetic configured targets: ${dashboard.syntheticConfiguredTargets}
- Alert routing configuration valid: ${dashboard.alertRoutingConfigured}
- Live alert delivery: unverified
- Runtime incident MTTR: ${dashboard.mttrHours ?? 'unknown'}
- Deployment success rate: unknown
- Rollback count: unknown
- Current-window distinct CI workflows: ${dashboard.ciWorkflowCount}

## Remaining Evidence

${dashboard.openActionItems.map((item) => `- ${item}`).join('\n')}
`
  fs.writeFileSync(OUT_MD, md, 'utf8')
  console.log(md)
}

if (require.main === module) main()
