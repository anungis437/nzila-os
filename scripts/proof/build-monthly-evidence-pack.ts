#!/usr/bin/env npx tsx

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { findRepoRoot } from '../lib/portfolio-governance'

interface SourceSpec {
  key: string
  path: string
  required?: boolean
}

function getMonthArg(): string {
  const explicit = process.argv.find((arg) => arg.startsWith('--month='))
  if (explicit) return explicit.slice('--month='.length)
  return new Date().toISOString().slice(0, 7)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readJsonIfExists<T>(root: string, relativePath: string): T | null {
  const absolutePath = safeJoin(root, relativePath)
  if (!existsSync(absolutePath)) return null
  // nosemgrep
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T
}

function writeText(root: string, relativePath: string, content: string): void {
  const absolutePath = safeJoin(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function safeJoin(root: string, relativePath: string): string {
  // nosemgrep
  const absolutePath = resolve(root, relativePath)
  // nosemgrep
  const normalizedRoot = `${resolve(root)}\\`
  // nosemgrep
  if (!absolutePath.startsWith(normalizedRoot) && absolutePath !== resolve(root)) {
    throw new Error(`Unsafe path outside repo root: ${relativePath}`)
  }
  return absolutePath
}

function main(): void {
  const root = findRepoRoot()
  const month = getMonthArg()
  const packDir = join(root, 'proof-artifacts', 'evidence-packs', month)
  const historyPath = join(root, 'proof-artifacts', 'evidence-packs', 'history.jsonl')

  if (existsSync(packDir)) {
    throw new Error(`Evidence pack for ${month} already exists. Monthly packs are append-only.`)
  }

  const existingHistory = existsSync(historyPath) ? readFileSync(historyPath, 'utf8').split('\n').filter(Boolean) : []
  for (const line of existingHistory) {
    const record = JSON.parse(line) as { month: string }
    if (record.month === month) {
      throw new Error(`History already contains ${month}. Monthly packs are append-only.`)
    }
  }

  const sourceSpecs: SourceSpec[] = [
    { key: 'dora', path: 'ops/outputs/dora-metrics.json', required: true },
    { key: 'cost', path: 'ops/outputs/cost-allocation.json', required: true },
    { key: 'onboarding', path: 'ops/outputs/onboarding-kpis.json', required: true },
    { key: 'portfolio', path: 'reports/portfolio-status.json', required: true },
    { key: 'release', path: 'reports/release-governance-audit.json', required: true },
    { key: 'sre', path: 'reports/sre-executive-dashboard.json', required: true },
    { key: 'finops', path: 'reports/finops-summary.json', required: true },
    { key: 'commercial', path: 'reports/commercial-board-pack.md' },
  ]

  const sources = sourceSpecs.map((spec) => {
    const absolutePath = safeJoin(root, spec.path)
    if (!existsSync(absolutePath)) {
      if (spec.required) throw new Error(`Required evidence source missing: ${spec.path}`)
      return { key: spec.key, path: spec.path, present: false, sha256: null, bytes: 0 }
    }
    // nosemgrep
    const content = readFileSync(absolutePath, 'utf8')
    return {
      key: spec.key,
      path: spec.path,
      present: true,
      sha256: sha256(content),
      bytes: Buffer.byteLength(content),
    }
  })

  const dora = readJsonIfExists<any>(root, 'ops/outputs/dora-metrics.json')
  const cost = readJsonIfExists<any>(root, 'ops/outputs/cost-allocation.json')
  const portfolio = readJsonIfExists<any>(root, 'reports/portfolio-status.json')
  const release = readJsonIfExists<any>(root, 'reports/release-governance-audit.json')
  const sre = readJsonIfExists<any>(root, 'reports/sre-executive-dashboard.json')
  const finops = readJsonIfExists<any>(root, 'reports/finops-summary.json')

  const snapshot = {
    month,
    generatedAt: new Date().toISOString(),
    metrics: {
      deploymentFrequencyPerWeek: dora?.metrics?.deployment_frequency?.value ?? null,
      leadTimeHours: dora?.metrics?.lead_time_for_change?.value ?? null,
      changeFailureRatePct: dora?.metrics?.change_failure_rate?.value ?? null,
      mttrHours: dora?.metrics?.mttr?.value ?? null,
      unresolvedCostApps: cost?.unresolved_app_count ?? finops?.dataSources?.costUnresolvedApps ?? null,
      totalMonthlyCostUsd: cost?.total_monthly_cost_usd ?? sre?.costTrend?.monthlyCostUsd ?? null,
      incidentsThisMonth: sre?.incidentsThisMonth ?? null,
      deploySuccessRatePct: sre?.deploySuccessRatePct ?? null,
      rollbackCount: sre?.rollbackCount ?? null,
      sellNowApps: portfolio?.summary?.sell_now ?? [],
      workflowSprawlScore: release?.workflowSprawlScore ?? null,
      releaseGovernanceScore: release?.releaseGovernanceScore ?? null,
    },
    sources,
  }

  mkdirSync(packDir, { recursive: true })
  writeText(root, `proof-artifacts/evidence-packs/${month}/snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`)

  const summary = [
    `# Evidence Pack ${month}`,
    '',
    `Generated: ${snapshot.generatedAt}`,
    '',
    '## Current Snapshot',
    '',
    `- Deployment frequency/week: ${snapshot.metrics.deploymentFrequencyPerWeek ?? 'unknown'}`,
    `- Lead time for change (hours): ${snapshot.metrics.leadTimeHours ?? 'unknown'}`,
    `- Change failure rate (%): ${snapshot.metrics.changeFailureRatePct ?? 'unknown'}`,
    `- MTTR (hours): ${snapshot.metrics.mttrHours ?? 'missing live incident feed'}`,
    `- Unresolved app cost mapping: ${snapshot.metrics.unresolvedCostApps ?? 'unknown'}`,
    `- Deploy success rate (%): ${snapshot.metrics.deploySuccessRatePct ?? 'missing live deploy feed'}`,
    `- Rollback count: ${snapshot.metrics.rollbackCount ?? 'missing live rollback feed'}`,
    '',
    '## Source Integrity',
    '',
    '| Source | Present | Bytes | SHA-256 |',
    '| --- | --- | ---: | --- |',
    ...sources.map((source) => `| ${source.path} | ${source.present ? 'yes' : 'no'} | ${source.bytes} | ${source.sha256 ?? 'n/a'} |`),
    '',
    '## Trend Note',
    '',
    'This pack is append-only. Real 30/60/90-day trend lines become available as monthly history accumulates in proof-artifacts/evidence-packs/history.jsonl.',
    '',
  ].join('\n') + '\n'

  writeText(root, `proof-artifacts/evidence-packs/${month}/README.md`, summary)

  const historyRecord = { month, generatedAt: snapshot.generatedAt, metrics: snapshot.metrics }
  mkdirSync(dirname(historyPath), { recursive: true })
  appendFileSync(historyPath, `${JSON.stringify(historyRecord)}\n`)

  const readmePath = 'proof-artifacts/evidence-packs/README.md'
  const historyForReadme = [...existingHistory.map((line) => JSON.parse(line) as { month: string }), { month }]
    .sort((left, right) => left.month.localeCompare(right.month))
  writeText(root, readmePath, [
    '# Monthly Evidence Packs',
    '',
    'Append-only monthly evidence snapshots generated from live repo artifacts.',
    '',
    ...historyForReadme.map((item) => `- [${item.month}](./${item.month}/README.md)`),
    '',
  ].join('\n'))

  console.log(summary)
}

main()