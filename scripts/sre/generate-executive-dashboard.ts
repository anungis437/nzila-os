import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const RELIABILITY_AUDIT = path.join(ROOT, 'reports', 'sre-reliability-audit.json')
const ALERT_DRY_RUN = path.join(ROOT, 'reports', 'sre-alert-routing-dry-run.json')
const SYNTHETIC_DRY_RUN = path.join(ROOT, 'reports', 'sre-synthetic-dry-run.json')
const COST_FILE = path.join(ROOT, 'ops', 'outputs', 'cost-allocation.json')
const OUT_JSON = path.join(ROOT, 'reports', 'sre-executive-dashboard.json')
const OUT_MD = path.join(ROOT, 'docs', 'ops', 'sre', 'executive-reliability-dashboard.md')

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function main() {
  const audit = readJson(RELIABILITY_AUDIT, {
    scores: {
      reliability: 0,
      observability: 0,
      incidentReadiness: 0,
      costGovernance: 0,
      mttrReadiness: 0,
    },
    missingHealthEndpointContracts: [] as Array<{ app: string }>,
  })

  const alert = readJson(ALERT_DRY_RUN, { passed: false, ownerlessAlerts: [] as string[] })
  const synthetic = readJson(SYNTHETIC_DRY_RUN, { targetCount: 0, results: [] as Array<{ app: string }> })
  const cost = readJson(COST_FILE, { total_monthly_cost_usd: null, unresolved_app_count: null })

  const dashboard = {
    generatedAt: new Date().toISOString(),
    portfolioUptimePct: null,
    incidentsThisMonth: null,
    appsBreachingSlo: audit.missingHealthEndpointContracts.map((a) => a.app),
    deploySuccessRatePct: null,
    rollbackCount: null,
    costTrend: {
      monthlyCostUsd: cost.total_monthly_cost_usd,
      unresolvedCostApps: cost.unresolved_app_count,
    },
    topRiskApps: audit.missingHealthEndpointContracts.map((a) => a.app).slice(0, 5),
    openActionItems: [
      'Complete live synthetic probe rollout for all Tier 1 endpoints.',
      'Integrate incident tracker feed for MTTR and monthly incident count.',
      'Backfill per-app uptime and deployment success from production telemetry.',
    ],
    scoreSummary: audit.scores,
    alertRoutingReady: alert.passed,
    syntheticConfiguredTargets: synthetic.targetCount,
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(dashboard, null, 2), 'utf8')

  const md = `# Executive Reliability Dashboard\n\nGenerated: ${dashboard.generatedAt}\n\n## Score Summary (0-10)\n\n- Reliability: ${dashboard.scoreSummary.reliability}\n- Observability: ${dashboard.scoreSummary.observability}\n- Incident Readiness: ${dashboard.scoreSummary.incidentReadiness}\n- Cost Governance: ${dashboard.scoreSummary.costGovernance}\n- MTTR Readiness: ${dashboard.scoreSummary.mttrReadiness}\n\n## Portfolio Signals\n\n- Apps breaching SLO contract: ${dashboard.appsBreachingSlo.length}\n- Synthetic configured targets: ${dashboard.syntheticConfiguredTargets}\n- Alert routing ready: ${dashboard.alertRoutingReady}\n- Unresolved app cost mapping: ${dashboard.costTrend.unresolvedCostApps ?? 'n/a'}\n\n## Top Risk Apps\n\n${dashboard.topRiskApps.map((a) => `- ${a}`).join('\n') || '- none'}\n`
  fs.writeFileSync(OUT_MD, md, 'utf8')
  console.log(md)
}

main()