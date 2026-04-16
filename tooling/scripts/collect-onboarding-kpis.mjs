#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const INPUT = resolve(ROOT, 'ops/inputs/onboarding-metrics.json')
const OUTPUT = resolve(ROOT, 'ops/outputs/onboarding-kpis.json')

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const defaultPayload = {
  period: 'quarterly',
  records: [
    {
      engineer: 'example-user',
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
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n')

console.log(`Onboarding KPI report written: ${OUTPUT}`)
