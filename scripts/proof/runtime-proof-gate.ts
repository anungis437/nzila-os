#!/usr/bin/env npx tsx

import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { computeRuntimeScore } from '@nzila/platform-ops/runtime/computeRuntimeScore'
import {
  RuntimeProofGateSchema,
  evaluateRuntimeGate,
  type GateEnv,
  type RuntimeProofForGate,
} from './runtime-proof-core'

const ROOT = (() => {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(path.join(__dirname, '..', '..'))
  }
  const fileUrl = new URL(import.meta.url)
  const filePath = fileUrl.pathname.replace(/^\/([A-Z]:)/, '$1')
  return path.resolve(path.join(path.dirname(filePath), '..', '..'))
})()

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function parseEnv(value: string | undefined): GateEnv {
  if (!value || value === 'staging') return 'staging'
  if (value === 'production') return 'production'
  throw new Error(`--env must be \"staging\" or \"production\", got: ${value}`)
}

function fail(msg: string): never {
  console.error(`✗ Gate FAILED: ${msg}`)
  process.exit(1)
}

function pass(msg: string): never {
  console.log(`✓ Gate PASSED: ${msg}`)
  process.exit(0)
}

export function runGate(env: GateEnv): void {
  const latestPath = path.join(ROOT, 'reports/runtime/runtime-latest.json')
  const healthPath = path.join(ROOT, 'reports/runtime/health-latest.json')
  if (!fs.existsSync(latestPath)) {
    fail(`runtime-latest.json not found at ${latestPath} — run proof:runtime first`)
  }
  if (!fs.existsSync(healthPath)) {
    fail(`health-latest.json not found at ${healthPath} — run proof:health first`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(latestPath, 'utf8'))
  } catch {
    fail(`Failed to parse ${latestPath}`)
  }

  const parsed = RuntimeProofGateSchema.safeParse(raw)
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    fail(`Proof document schema validation failed: ${errors}`)
  }

  const proof = parsed.data as RuntimeProofForGate

  let healthRaw: unknown
  try {
    healthRaw = JSON.parse(fs.readFileSync(healthPath, 'utf8'))
  } catch {
    fail(`Failed to parse ${healthPath}`)
  }

  const expectedRuntime = computeRuntimeScore(healthRaw)
  if (proof.score !== expectedRuntime.score) {
    fail(
      `Runtime score mismatch: runtime-latest score=${proof.score}, expected=${expectedRuntime.score} from health-latest`,
    )
  }

  const healthOverallStatus =
    typeof (healthRaw as { overallStatus?: unknown }).overallStatus === 'string'
      ? String((healthRaw as { overallStatus?: unknown }).overallStatus)
      : 'unknown'
  if (proof.score === 100 && healthOverallStatus !== 'pass') {
    fail(`Runtime score invalid: score=100 but health overallStatus=${healthOverallStatus}`)
  }

  const decision = evaluateRuntimeGate(proof, env)

  console.log(`Runtime Proof Gate [${env.toUpperCase()}]`)
  console.log(`  Period:   ${proof.period}`)
  console.log(`  Score:    ${proof.score}/100 (Grade ${proof.grade})`)
  console.log(`  Blocking: ${proof.blockingFindings.length}`)
  console.log(`  Unknowns: ${proof.unknowns.length}`)
  if (proof.bootstrapSources.length > 0) {
    console.log(`  ⚠ Bootstrap sources: ${proof.bootstrapSources.join(', ')}`)
  }

  if (decision.pass) {
    pass(`${env} gate passed`)
  }

  console.error('\nBlocking issues:')
  for (const reason of decision.reasons) {
    console.error(`  ✗ ${reason}`)
  }
  fail(`${env} gate: ${decision.reasons.length} condition(s) not met`)
}

export function main(): void {
  try {
    const env = parseEnv(parseArg('--env'))
    runGate(env)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Unexpected gate error')
  }
}

const isDirectRun = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main()
}
