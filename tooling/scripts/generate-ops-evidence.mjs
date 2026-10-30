#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OPS_OUTPUTS = resolve(ROOT, 'ops/outputs')
const SNAPSHOT_JSON = resolve(ROOT, 'reports/ops/snapshot.json')
const SNAPSHOT_MD = resolve(ROOT, 'reports/ops/snapshot.md')

function readJsonIfExists(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * A newly generated wrapper must NOT present two-month-old source exports as
 * observations from the current 30-day window. Stale sources become explicit
 * null with documented remediation, not fabricated current measurements.
 */
const SOURCE_MAX_AGE_DAYS = 7
export function requireFreshSource(data, label, now = Date.now()) {
  if (!data) return { data: null, reason: `Missing ${label} source export` }
  const collected = Date.parse(data.collected_at ?? '')
  if (!Number.isFinite(collected)) {
    return { data: null, reason: `${label} source has no verifiable collected_at timestamp` }
  }
  const age = now - collected
  if (age < -5 * 60 * 1000 || age > SOURCE_MAX_AGE_DAYS * 86400000) {
    return { data: null, reason: `${label} source export is outside the verified seven-day freshness window; recollect the upstream source` }
  }
  return { data, reason: null }
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round(value, digits = 2) {
  if (value === null || value === undefined) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toIsoDate(input) {
  if (!input) return null
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function source(value, source, sourceNeeded = null) {
  return {
    value,
    source,
    source_needed: value === null ? sourceNeeded : null,
  }
}

/**
 * GitHub metrics are observational input, not a source of fabricated PASS.
 * An API outage emits explicit null with source debt rather than crashing the
 * documentation check. Runtime readiness still needs separate measurements.
 */
export async function fetchBuildMetricsFromGitHub({
  env = process.env,
  httpGet = fetch,
  now = Date.now(),
} = {}) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN
  const repo = env.GITHUB_REPOSITORY
  const fallback = (reason, origin = 'GitHub Actions API') => ({
    buildSuccessRate: null,
    medianBuildMinutes: null,
    sourceNeeded: reason,
    source: origin,
  })
  if (!token || !repo) {
    return fallback('Authenticated GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required to query CI history.',
      'GitHub Actions API (not available in current execution context)')
  }
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
    return fallback('GITHUB_REPOSITORY is not an owner/repository identifier')
  }
  const since = new Date(now - 30 * 86400000).toISOString()
  const url = 'https://api.github.com/repos/' + repo +
    '/actions/workflows/ci.yml/runs?per_page=100&branch=main&created=>=' + encodeURIComponent(since)
  let data
  try {
    const res = await httpGet(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return fallback('GitHub Actions API HTTP ' + res.status + ': provider unavailable or token lacks scope.')
    }
    data = await res.json()
  } catch (error) {
    const code = error instanceof Error ? error.name : 'UNKNOWN'
    return fallback('Unable to obtain authenticated GitHub Actions evidence (' + code + '); no metrics inferred.')
  }
  const runs = Array.isArray(data?.workflow_runs) ? data.workflow_runs : []
  const completed = runs.filter(r => {
    if (r?.status !== 'completed') return false
    if (!['success', 'failure', 'cancelled', 'timed_out', 'action_required'].includes(r.conclusion)) return false
    const finished = Date.parse(r.updated_at ?? '')
    return Number.isFinite(finished) && finished >= now - 30 * 86400000 && finished <= now + 5 * 60000
  })
  if (!completed.length) return fallback('No verifiable completed ci.yml workflow runs in the last 30 days.')
  const successCount = completed.filter(r => r.conclusion === 'success').length
  const durations = completed.map(r => {
    const started = Date.parse(r.run_started_at ?? '')
    const ended = Date.parse(r.updated_at ?? '')
    return Number.isFinite(started) && Number.isFinite(ended) && ended >= started
      ? (ended - started) / 60000 : null
  }).filter(v => v !== null).sort((a, b) => a - b)
  const mid = Math.floor(durations.length / 2)
  const median = !durations.length ? null : durations.length % 2
    ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2
  const origin = 'GitHub Actions API ci.yml runs on main (30d window, completed runs: ' + completed.length + ')'
  return {
    buildSuccessRate: round(successCount / completed.length * 100, 2),
    medianBuildMinutes: round(median, 2),
    sourceNeeded: median === null ? 'Run duration unavailable; source requires run_started_at and updated_at.' : null,
    source: origin,
  }
}

function renderMarkdown(snapshot) {
  const rows = [
    ['deploy_frequency_30d', snapshot.metrics.deploy_frequency_30d.value, 'deploys/week', snapshot.metrics.deploy_frequency_30d.source],
    ['build_success_rate_30d', snapshot.metrics.build_success_rate_30d.value, '%', snapshot.metrics.build_success_rate_30d.source],
    ['median_build_minutes', snapshot.metrics.median_build_minutes.value, 'minutes', snapshot.metrics.median_build_minutes.source],
    ['change_failure_rate_30d', snapshot.metrics.change_failure_rate_30d.value, '%', snapshot.metrics.change_failure_rate_30d.source],
    ['mttr_minutes', snapshot.metrics.mttr_minutes.value, 'minutes', snapshot.metrics.mttr_minutes.source],
    ['uptime_30d', snapshot.metrics.uptime_30d.value, '%', snapshot.metrics.uptime_30d.source],
    ['p50_latency_ms', snapshot.metrics.p50_latency_ms.value, 'ms', snapshot.metrics.p50_latency_ms.source],
    ['p95_latency_ms', snapshot.metrics.p95_latency_ms.value, 'ms', snapshot.metrics.p95_latency_ms.source],
    ['auth_success_rate', snapshot.metrics.auth_success_rate.value, '%', snapshot.metrics.auth_success_rate.source],
    ['error_rate', snapshot.metrics.error_rate.value, '%', snapshot.metrics.error_rate.source],
    ['monthly_infra_cost_estimate', snapshot.metrics.monthly_infra_cost_estimate.value, 'USD/month', snapshot.metrics.monthly_infra_cost_estimate.source],
    ['incidents_last_30d', snapshot.metrics.incidents_last_30d.value, 'count', snapshot.metrics.incidents_last_30d.source],
  ]

  const unresolved = Object.entries(snapshot.metrics)
    .filter(([, entry]) => entry.value === null)
    .map(([key, entry]) => `- ${key}: ${entry.source_needed}`)

  const lines = []
  lines.push('# Operational Evidence Snapshot')
  lines.push('')
  lines.push(`> Generated: ${snapshot._meta.generated_at}`)
  lines.push('> Policy: fields without measurable evidence remain null and include source_needed.')
  lines.push('')
  lines.push('## Metrics (30-day window unless noted)')
  lines.push('')
  lines.push('| Metric | Value | Unit | Source |')
  lines.push('|---|---:|---|---|')

  for (const [name, value, unit, src] of rows) {
    const val = value === null ? 'null' : String(value)
    lines.push(`| ${name} | ${val} | ${unit} | ${src} |`)
  }

  lines.push('')
  lines.push('## Missing Source Wiring')
  lines.push('')
  if (unresolved.length === 0) {
    lines.push('- None')
  } else {
    lines.push(...unresolved)
  }

  lines.push('')
  lines.push('## Inputs Used')
  lines.push('')
  lines.push('- ops/outputs/dora-metrics.json')
  lines.push('- ops/outputs/cost-allocation.json')
  lines.push('- GitHub Actions API (when token/repo context is available)')

  return `${lines.join('\n')}\n`
}

async function main() {
  const doraSource = requireFreshSource(
    readJsonIfExists(resolve(OPS_OUTPUTS, 'dora-metrics.json')),
    'DORA metrics',
  )
  const costSource = requireFreshSource(
    readJsonIfExists(resolve(OPS_OUTPUTS, 'cost-allocation.json')),
    'Cost allocation',
  )
  const dora = doraSource.data
  const cost = costSource.data
  const build = await fetchBuildMetricsFromGitHub()

  const deploysPerWeek = toNumber(dora?.metrics?.deployment_frequency?.value)
  const changeFailureRate = toNumber(dora?.metrics?.change_failure_rate?.value)
  // The existing export may substitute vulnerability-remediation MTTR for
  // incident recovery. Never present that proxy as actual service MTTR.
  const mttrHours = dora?.metrics?.mttr?.source?.includes('mttr-dashboard')
    ? null : toNumber(dora?.metrics?.mttr?.value)
  const mttrMinutes = mttrHours === null ? null : round(mttrHours * 60, 2)

  const costMonthly = toNumber(cost?.total_monthly_cost_usd)

  const snapshot = {
    _meta: {
      schema_version: '2.0.0',
      generated_at: new Date().toISOString(),
      generator: 'tooling/scripts/generate-ops-evidence.mjs',
      freshness_days: 7,
      window_days: 30,
    },
    metrics: {
      deploy_frequency_30d: source(
        deploysPerWeek,
        dora ? 'ops/outputs/dora-metrics.json: metrics.deployment_frequency.value (deploys/week)' : 'ops/outputs/dora-metrics.json',
        dora ? null : `${doraSource.reason}. Run pnpm collect:dora with authoritative access.`,
      ),
      build_success_rate_30d: source(
        build.buildSuccessRate,
        build.source,
        build.sourceNeeded,
      ),
      median_build_minutes: source(
        build.medianBuildMinutes,
        build.source,
        build.sourceNeeded,
      ),
      change_failure_rate_30d: source(
        changeFailureRate,
        dora ? 'ops/outputs/dora-metrics.json: metrics.change_failure_rate.value' : 'ops/outputs/dora-metrics.json',
        dora ? null : `${doraSource.reason}. Run pnpm collect:dora with authoritative access.`,
      ),
      mttr_minutes: source(
        mttrMinutes,
        dora ? 'ops/outputs/dora-metrics.json: metrics.mttr.value (hours -> minutes)' : 'ops/outputs/dora-metrics.json',
        mttrMinutes === null ? 'Incident tracker integration required. Historical vulnerability MTTR is not incident recovery time.' : null,
      ),
      uptime_30d: source(
        null,
        'Azure Monitor / Application Insights uptime SLO exporter',
        'No committed uptime export in repository. Wire Azure Monitor export to ops/outputs/uptime.json.',
      ),
      p50_latency_ms: source(
        null,
        'Application Insights latency export',
        'No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.',
      ),
      p95_latency_ms: source(
        null,
        'Application Insights latency export',
        'No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.',
      ),
      auth_success_rate: source(
        null,
        'platform-auth auth event rollup',
        'No auth rollup artifact found. Add monthly auth success export to ops/outputs/auth-metrics.json.',
      ),
      error_rate: source(
        null,
        'Application Insights / Sentry error metric export',
        'No error-rate rollup artifact found. Add monthly app error export to ops/outputs/error-rate.json.',
      ),
      monthly_infra_cost_estimate: source(
        costMonthly,
        cost ? 'ops/outputs/cost-allocation.json: total_monthly_cost_usd' : 'ops/outputs/cost-allocation.json',
        costMonthly === null ? `${costSource.reason}. Run pnpm collect:cost using Azure Cost Management.` : null,
      ),
      incidents_last_30d: source(
        null,
        'Incident registry export (GitHub issues/PagerDuty)',
        'No incident registry artifact found in repository for 30d count.',
      ),
    },
  }

  mkdirSync(dirname(SNAPSHOT_JSON), { recursive: true })
  writeFileSync(SNAPSHOT_JSON, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  writeFileSync(SNAPSHOT_MD, renderMarkdown(snapshot), 'utf8')

  console.log('Generated operational evidence snapshot:')
  console.log(`- ${SNAPSHOT_JSON}`)
  console.log(`- ${SNAPSHOT_MD}`)
  console.log(`- deploy_frequency_30d: ${snapshot.metrics.deploy_frequency_30d.value ?? 'null'}`)
  console.log(`- build_success_rate_30d: ${snapshot.metrics.build_success_rate_30d.value ?? 'null'}`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch((error) => {
  console.error('Failed to generate ops evidence snapshot:', error)
  process.exit(1)
})
