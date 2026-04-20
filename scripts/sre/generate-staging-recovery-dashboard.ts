import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')
const SMOKE_REPORT_PATH = path.join(ROOT, 'ops', 'smoke', 'smoke-staging-latest.json')
const OUT_JSON = path.join(ROOT, 'reports', 'staging-recovery-dashboard.json')
const OUT_MD = path.join(ROOT, 'docs', 'ops', 'sre', 'staging-recovery-dashboard.md')

type Inventory = {
  apps: Record<string, {
    owners?: string[]
    routing?: {
      staging?: string
      healthPath?: string
      readyPath?: string
      versionPath?: string
    }
  }>
}

type ProbeResult = {
  endpoint: 'health' | 'ready' | 'version'
  status: number
  ok: boolean
  failureType: string
  error?: string
}

type SmokeResult = {
  app: string
  host: string
  ok: boolean
  probes: ProbeResult[]
  failureSummary: string[]
}

type SmokeReport = {
  timestamp: string
  environment: string
  results: SmokeResult[]
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function parseApps(defaultApps: string[]): string[] {
  const index = process.argv.indexOf('--apps')
  if (index < 0 || !process.argv[index + 1]) {
    return defaultApps
  }
  return process.argv[index + 1].split(',').map((app) => app.trim()).filter(Boolean)
}

function rootCauseHint(failureSummary: string[]): string {
  if (failureSummary.includes('not_found')) {
    return 'route_missing_or_not_deployed'
  }
  if (failureSummary.includes('server_error')) {
    return 'runtime_failure_or_dependency_failure'
  }
  if (failureSummary.includes('dns') || failureSummary.includes('connectivity')) {
    return 'network_or_ingress_connectivity'
  }
  if (failureSummary.includes('timeout')) {
    return 'probe_timeout_or_dependency_hang'
  }
  if (failureSummary.includes('auth') || failureSummary.includes('redirect')) {
    return 'auth_or_ingress_redirect_policy'
  }
  return 'unknown'
}

function main() {
  const inventory = readJson<Inventory>(INVENTORY_PATH, { apps: {} })
  const smoke = readJson<SmokeReport>(SMOKE_REPORT_PATH, {
    timestamp: new Date(0).toISOString(),
    environment: 'staging',
    results: [],
  })

  const apps = parseApps(['web', 'console', 'partners', 'union-eyes', 'cfo', 'flow', 'abr'])

  const rows = apps.map((app) => {
    const appInventory = inventory.apps[app]
    const smokeResult = smoke.results.find((result) => result.app === app)

    const stagingHost = appInventory?.routing?.staging ?? 'n/a'
    const expectedInStaging = Boolean(stagingHost && stagingHost !== 'blocked' && stagingHost !== 'pilot-only' && stagingHost !== 'n/a')
    const probesByEndpoint = new Map((smokeResult?.probes ?? []).map((probe) => [probe.endpoint, probe]))

    const health = probesByEndpoint.get('health')
    const ready = probesByEndpoint.get('ready')
    const version = probesByEndpoint.get('version')

    const failures = smokeResult?.failureSummary ?? []

    return {
      app,
      expectedInStaging,
      owner: (appInventory?.owners ?? ['unassigned']).join(', '),
      timestamp: smoke.timestamp,
      host: stagingHost,
      endpoints: {
        health: health ?? null,
        ready: ready ?? null,
        version: version ?? null,
      },
      overallStatus: smokeResult?.ok ? 'healthy' : expectedInStaging ? 'failing' : 'not_expected',
      rootCauseHint: smokeResult?.ok ? 'none' : rootCauseHint(failures),
      fixStatus: smokeResult?.ok ? 'resolved' : 'open',
    }
  })

  const dashboard = {
    generatedAt: new Date().toISOString(),
    sourceSmokeTimestamp: smoke.timestamp,
    environment: 'staging',
    appCount: rows.length,
    passing: rows.filter((row) => row.overallStatus === 'healthy').length,
    failing: rows.filter((row) => row.overallStatus === 'failing').length,
    rows,
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(dashboard, null, 2), 'utf8')

  const md = `# Staging Recovery Dashboard\n\nGenerated: ${dashboard.generatedAt}\nSource smoke timestamp: ${dashboard.sourceSmokeTimestamp}\n\n## Summary\n\n- Apps scanned: ${dashboard.appCount}\n- Passing: ${dashboard.passing}\n- Failing: ${dashboard.failing}\n\n## App Status\n\n${rows.map((row) => {
    const health = row.endpoints.health ? `${row.endpoints.health.status}` : 'n/a'
    const ready = row.endpoints.ready ? `${row.endpoints.ready.status}` : 'n/a'
    const version = row.endpoints.version ? `${row.endpoints.version.status}` : 'n/a'
    return `- ${row.app}: status=${row.overallStatus}, health=${health}, ready=${ready}, version=${version}, owner=${row.owner}, rootCauseHint=${row.rootCauseHint}, fixStatus=${row.fixStatus}`
  }).join('\n')}\n`

  fs.writeFileSync(OUT_MD, md, 'utf8')

  console.log(md)
}

main()
