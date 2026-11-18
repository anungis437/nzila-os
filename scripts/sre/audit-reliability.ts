import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OUT_JSON = path.join(ROOT, 'reports', 'sre-reliability-audit.json')
const OUT_MD = path.join(ROOT, 'docs', 'categories', 'platform-and-operations', 'ops', 'sre', 'portfolio-reliability-audit.md')

const TARGET_APPS = [
  'union-eyes', 'abr', 'flow', 'web', 'partners', 'cfo',
  'zonga', 'agrimo', 'cora', 'trade', 'mobility',
  'console', 'control-plane', 'orchestrator-api',
] as const

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

function score(passed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((passed / total) * 10)
}

function endpointCoverage() {
  const coverage = TARGET_APPS.map((app) => {
    if (app === 'orchestrator-api') {
      return {
        app,
        health: exists(`apps/${app}/src/routes/health.ts`),
        ready: exists(`apps/${app}/src/routes/ready.ts`),
        version: exists(`apps/${app}/src/routes/version.ts`),
      }
    }

    return {
      app,
      health: exists(`apps/${app}/app/api/health/route.ts`),
      ready: exists(`apps/${app}/app/api/ready/route.ts`),
      version: exists(`apps/${app}/app/api/version/route.ts`),
    }
  })

  return coverage
}

function main() {
  const endpoint = endpointCoverage()
  const missingHealthEndpoints = endpoint.filter((x) => !x.health || !x.ready || !x.version)

  const reliabilityChecks = [
    exists('governance/sre/service-tiers.json'),
    exists('governance/sre/error-budget-policy.json'),
    exists('governance/sre/release-reliability-linkage.json'),
    exists('scripts/sre/validate-health-contract.ts'),
    exists('scripts/sre/synthetic-dry-run.ts'),
  ]

  const observabilityChecks = [
    exists('packages/platform-observability/src/index.ts'),
    exists('packages/platform-observability/src/reliability.ts'),
    exists('tooling/scripts/collect-dora-metrics.mjs'),
    exists('tooling/scripts/collect-cost-attribution.mjs'),
    exists('governance/sre/synthetic-checks.json'),
  ]

  const incidentChecks = [
    exists('docs/categories/platform-and-operations/ops/incidents/sev1-runbook.md'),
    exists('docs/categories/platform-and-operations/ops/incidents/sev2-runbook.md'),
    exists('docs/categories/platform-and-operations/ops/incidents/communication-template.md'),
    exists('docs/categories/platform-and-operations/ops/incidents/postmortem-template.md'),
    exists('governance/sre/oncall-ownership-matrix.json'),
  ]

  const costChecks = [
    exists('governance/sre/cost-governance.json'),
    exists('tooling/scripts/collect-cost-attribution.mjs'),
    exists('ops/outputs/cost-allocation.json'),
    exists('reports/sre-executive-dashboard.json'),
  ]

  const mttrChecks = [
    exists('docs/categories/platform-and-operations/ops/incident-response.md'),
    exists('docs/categories/platform-and-operations/ops/on-call.md'),
    exists('docs/categories/platform-and-operations/ops/gameday-chaos-readiness.md'),
    exists('governance/sre/alert-policy.json'),
    exists('scripts/sre/alert-routing-dry-run.ts'),
  ]

  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'SOURCE_AND_CONFIGURATION_PRESENCE_ONLY',
    note: 'Scores establish source and configuration presence; they do not establish live reliability, SLO attainment, alert delivery or recovery.',
    appCount: TARGET_APPS.length,
    endpointCoverage: endpoint,
    missingHealthEndpointContracts: missingHealthEndpoints,
    scores: {
      reliability: score(reliabilityChecks.filter(Boolean).length, reliabilityChecks.length),
      observability: score(observabilityChecks.filter(Boolean).length, observabilityChecks.length),
      incidentReadiness: score(incidentChecks.filter(Boolean).length, incidentChecks.length),
      costGovernance: score(costChecks.filter(Boolean).length, costChecks.length),
      mttrReadiness: score(mttrChecks.filter(Boolean).length, mttrChecks.length),
    },
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8')

  const md = `# Portfolio Reliability Audit\n\nGenerated: ${report.generatedAt}\n\n${report.note}\n\n## Source and Configuration Scores (0-10)\n\n- Reliability Score: ${report.scores.reliability}\n- Observability Score: ${report.scores.observability}\n- Incident Procedure Score: ${report.scores.incidentReadiness}\n- Cost Governance Score: ${report.scores.costGovernance}\n- Recovery Procedure Score: ${report.scores.mttrReadiness}\n\n## Endpoint Source Contract Coverage\n\n- Apps scanned: ${report.appCount}\n- Apps missing one or more required endpoint source files: ${report.missingHealthEndpointContracts.length}\n\n## Missing Endpoint Source Contracts\n\n${report.missingHealthEndpointContracts.map((a) => `- ${a.app}: health=${a.health}, ready=${a.ready}, version=${a.version}`).join('\n') || '- none'}\n`
  fs.writeFileSync(OUT_MD, md, 'utf8')

  console.log(md)
}

main()
