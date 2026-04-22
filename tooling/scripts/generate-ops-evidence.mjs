#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OPS_OUTPUTS = resolve(ROOT, 'ops/outputs')
const SNAPSHOT_JSON = resolve(ROOT, 'reports/ops/snapshot.json')
const SNAPSHOT_MD = resolve(ROOT, 'reports/ops/snapshot.md')

function readJsonIfExists(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
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

async function fetchBuildMetricsFromGitHub() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  if (!token || !repo) {
    return {
      buildSuccessRate: null,
      medianBuildMinutes: null,
      sourceNeeded: 'Set GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY to query GitHub Actions build history.',
      source: 'GitHub Actions API (not available in current execution context)',
    }
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const url = `https://api.github.com/repos/${repo}/actions/workflows/ci.yml/runs?per_page=100&branch=main&created=>=${since}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    return {
      buildSuccessRate: null,
      medianBuildMinutes: null,
      sourceNeeded: `GitHub API request failed (${res.status}); verify token scopes/actions visibility.`,
      source: 'GitHub Actions API',
    }
  }

  const data = await res.json()
  const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : []
  const completed = runs.filter((r) => r.status === 'completed')

  if (completed.length === 0) {
    return {
      buildSuccessRate: null,
      medianBuildMinutes: null,
      sourceNeeded: 'No completed ci.yml workflow runs found for the last 30 days.',
      source: 'GitHub Actions API',
    }
  }

  const successes = completed.filter((r) => r.conclusion === 'success').length
  const successRate = round((successes / completed.length) * 100, 2)

  const durationsMinutes = completed
    .map((r) => {
      if (!r.run_started_at || !r.updated_at) return null
      const started = new Date(r.run_started_at).getTime()
      const ended = new Date(r.updated_at).getTime()
      if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return null
      return (ended - started) / 60000
    })
    .filter((v) => v !== null)
    .sort((a, b) => a - b)

  const median = durationsMinutes.length === 0
    ? null
    : durationsMinutes.length % 2 === 1
      ? durationsMinutes[(durationsMinutes.length - 1) / 2]
      : (durationsMinutes[durationsMinutes.length / 2 - 1] + durationsMinutes[durationsMinutes.length / 2]) / 2

  return {
    buildSuccessRate: successRate,
    medianBuildMinutes: round(median, 2),
    sourceNeeded: null,
    source: `GitHub Actions API ci.yml runs on main (30d window, completed runs: ${completed.length})`,
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
  const dora = readJsonIfExists(resolve(OPS_OUTPUTS, 'dora-metrics.json'))
  const cost = readJsonIfExists(resolve(OPS_OUTPUTS, 'cost-allocation.json'))
  const build = await fetchBuildMetricsFromGitHub()

  const deploysPerWeek = toNumber(dora?.metrics?.deployment_frequency?.value)
  const changeFailureRate = toNumber(dora?.metrics?.change_failure_rate?.value)
  const mttrHours = toNumber(dora?.metrics?.mttr?.value)
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
        dora ? null : 'Run pnpm collect:dora to generate ops/outputs/dora-metrics.json.',
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
        dora ? null : 'Run pnpm collect:dora to generate ops/outputs/dora-metrics.json.',
      ),
      mttr_minutes: source(
        mttrMinutes,
        dora ? 'ops/outputs/dora-metrics.json: metrics.mttr.value (hours -> minutes)' : 'ops/outputs/dora-metrics.json',
        mttrMinutes === null ? 'Incident tracker integration required; dora-metrics currently reports null mttr.' : null,
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
        costMonthly === null ? 'Run pnpm collect:cost with Azure API enabled to populate real monthly cost.' : null,
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

main().catch((error) => {
  console.error('Failed to generate ops evidence snapshot:', error)
  process.exit(1)
})
