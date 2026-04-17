#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const INPUT = resolve(ROOT, 'ops/inputs/onboarding-metrics.json')
const OUTPUT = resolve(ROOT, 'ops/outputs/onboarding-kpis.json')

const GITHUB_REPO = process.env.ONBOARDING_GITHUB_REPO ?? 'anungis437/nzila-os'
const WINDOW_DAYS = Number(process.env.ONBOARDING_GITHUB_WINDOW_DAYS ?? 90)

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isoDateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function ghSearchCount(query) {
  try {
    const raw = execSync(
      `gh api \"search/issues?q=${encodeURIComponent(query)}\" --jq .total_count`,
      { encoding: 'utf-8' },
    ).trim()
    const count = Number(raw)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

const defaultPayload = {
  period: 'quarterly',
  records: [
    {
      engineer: 'example-user',
      github_login: 'example-user',
      start_date: null,
      days_to_first_merged_pr: null,
      days_to_oncall_ready: null,
      setup_success_without_manual_help: null,
    },
  ],
}

let payload = defaultPayload
try {
  payload = JSON.parse(readFileSync(INPUT, 'utf-8'))
} catch {
  payload = defaultPayload
}

const records = Array.isArray(payload.records) ? payload.records : []
const mergedDays = records
  .map((r) => r.days_to_first_merged_pr)
  .filter((v) => Number.isFinite(Number(v)))
  .map((v) => Number(v))
const oncallDays = records
  .map((r) => r.days_to_oncall_ready)
  .filter((v) => Number.isFinite(Number(v)))
  .map((v) => Number(v))
const setupFlags = records
  .map((r) => r.setup_success_without_manual_help)
  .filter((v) => typeof v === 'boolean')

const avgMerged =
  mergedDays.length > 0
    ? Number((mergedDays.reduce((a, b) => a + b, 0) / mergedDays.length).toFixed(2))
    : null
const avgOncall =
  oncallDays.length > 0
    ? Number((oncallDays.reduce((a, b) => a + b, 0) / oncallDays.length).toFixed(2))
    : null
const setupSuccessPct =
  setupFlags.length > 0
    ? Number(((setupFlags.filter(Boolean).length * 100) / setupFlags.length).toFixed(1))
    : null

const windowStart = isoDateDaysAgo(WINDOW_DAYS)
const githubEnrichment = records.map((record) => {
  const login = typeof record.github_login === 'string' ? record.github_login : null
  if (!login) {
    return {
      engineer: record.engineer ?? 'unknown',
      github_login: null,
      merged_pr_count_window: null,
      first_merged_days_from_start: record.days_to_first_merged_pr ?? null,
    }
  }

  const mergedCount = ghSearchCount(
    `repo:${GITHUB_REPO} is:pr is:merged author:${login} merged:>=${windowStart}`,
  )

  return {
    engineer: record.engineer ?? login,
    github_login: login,
    merged_pr_count_window: mergedCount,
    first_merged_days_from_start: record.days_to_first_merged_pr ?? null,
  }
})

const githubCoverage = githubEnrichment.filter((r) => r.merged_pr_count_window != null).length

const output = {
  timestamp: new Date().toISOString(),
  period: payload.period ?? 'quarterly',
  population_size: records.length,
  metrics: {
    avg_days_to_first_merged_pr: avgMerged,
    avg_days_to_oncall_ready: avgOncall,
    setup_success_pct: setupSuccessPct,
  },
  targets: {
    max_days_to_first_merged_pr: safeNumber(process.env.ONBOARDING_TARGET_FIRST_PR_DAYS, 5),
    max_days_to_oncall_ready: safeNumber(process.env.ONBOARDING_TARGET_ONCALL_DAYS, 42),
    min_setup_success_pct: safeNumber(process.env.ONBOARDING_TARGET_SETUP_SUCCESS_PCT, 90),
  },
  source_file: 'ops/inputs/onboarding-metrics.json',
  github_enrichment: {
    repo: GITHUB_REPO,
    window_days: WINDOW_DAYS,
    window_start: windowStart,
    records_with_api_data: githubCoverage,
    records: githubEnrichment,
  },
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n')

console.log(`Onboarding KPI report written: ${OUTPUT}`)
console.log(
  `GitHub enrichment coverage: ${githubCoverage}/${records.length} records (repo ${GITHUB_REPO})`,
)
