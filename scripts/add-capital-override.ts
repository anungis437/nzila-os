#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { findRepoRoot } from './lib/portfolio-governance'

interface OverrideEntry {
  date: string
  product: string
  engine_recommendation: string
  override_decision: string
  reason: string
  owner: string
  outcome_status?: 'pending' | 'correct' | 'incorrect'
  outcome_note?: string
}

interface OverrideLog {
  overrides: OverrideEntry[]
}

function arg(flag: string): string | null {
  const token = process.argv.find((value) => value.startsWith(`${flag}=`))
  return token ? token.slice(flag.length + 1) : null
}

function requireArg(flag: string): string {
  const value = arg(flag)
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required argument ${flag}=...`)
  }
  return value.trim()
}

function main(): void {
  const root = findRepoRoot()
  const filePath = join(root, 'governance', 'capital', 'override-log.json')
  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as OverrideLog

  const entry: OverrideEntry = {
    date: arg('--date') ?? new Date().toISOString().slice(0, 10),
    product: requireArg('--product'),
    engine_recommendation: requireArg('--engine'),
    override_decision: requireArg('--override'),
    reason: requireArg('--reason'),
    owner: requireArg('--owner'),
    outcome_status: (arg('--status') as OverrideEntry['outcome_status'] | null) ?? 'pending',
    outcome_note: arg('--outcome-note') ?? undefined,
  }

  payload.overrides.push(entry)
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)

  console.log('\n[add-capital-override] PASS')
  console.log(`Added override for ${entry.product} on ${entry.date}`)
}

main()