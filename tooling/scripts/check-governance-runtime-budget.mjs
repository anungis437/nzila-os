#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const OUTPUT = resolve(ROOT, 'ops/outputs/governance-runtime-budget.json')

const MAX_MINUTES = Number(process.env.GOVERNANCE_MAX_RUNTIME_MINUTES ?? 45)
const START_TS = Number(process.env.GOVERNANCE_JOB_START_TS ?? 0)
const ENFORCE = process.argv.includes('--enforce')

const nowTs = Math.floor(Date.now() / 1000)
const elapsedSeconds = START_TS > 0 ? Math.max(0, nowTs - START_TS) : null
const elapsedMinutes = elapsedSeconds == null ? null : Number((elapsedSeconds / 60).toFixed(2))

const status =
  elapsedMinutes == null
    ? 'unknown'
    : elapsedMinutes <= MAX_MINUTES
      ? 'within_budget'
      : 'over_budget'

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      start_ts: START_TS || null,
      elapsed_minutes: elapsedMinutes,
      max_minutes: MAX_MINUTES,
      status,
    },
    null,
    2,
  ) + '\n',
)

console.log(`Governance runtime budget status: ${status}`)
console.log(`Report written: ${OUTPUT}`)

if (ENFORCE && status === 'over_budget') {
  console.error(`Governance runtime exceeded budget (${elapsedMinutes}m > ${MAX_MINUTES}m)`)
  process.exit(1)
}
