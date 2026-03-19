#!/usr/bin/env npx tsx
/**
 * Proof Artifact Verifier — validates completeness and JSON parsability
 * of proof artifacts produced by the proof runner.
 *
 * Usage:
 *   npx tsx scripts/proof/verify-artifacts.ts
 *
 * Exit code 0 = all valid, 1 = failures found.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname2 = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname2, '..', '..')
const ARTIFACT_DIR = join(ROOT, 'proof-artifacts')

const EXPECTED_SCENARIOS: Record<string, string[]> = {
  'ue-governed-mutation': [
    'summary.json',
    'trace.json',
    'request.json',
    'response.json',
    'governance.json',
    'audit.json',
    'audit-chain.json',
  ],
  'ai-controlled-request': [
    'summary.json',
    'request.json',
    'response.json',
    'ai-control.json',
    'trace.json',
  ],
  'event-contract-flow': [
    'summary.json',
    'event.json',
    'trace.json',
    'request.json',
    'response.json',
  ],
  'compliance-sensitive-action': [
    'summary.json',
    'trace.json',
    'request.json',
    'response.json',
    'governance.json',
    'audit.json',
    'audit-chain.json',
  ],
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  Proof Artifact Verifier')
console.log('═══════════════════════════════════════════════════════════════')

if (!existsSync(ARTIFACT_DIR)) {
  console.error('  ❌ No proof-artifacts/ directory found. Run proof:run first.')
  process.exit(1)
}

let failures = 0
let totalFiles = 0

for (const [scenario, expectedFiles] of Object.entries(EXPECTED_SCENARIOS)) {
  const scenarioDir = join(ARTIFACT_DIR, scenario)
  console.log(`\n  Scenario: ${scenario}`)

  if (!existsSync(scenarioDir)) {
    console.error(`    ❌ Missing directory: ${scenario}/`)
    failures++
    continue
  }

  for (const file of expectedFiles) {
    const filePath = join(scenarioDir, file)
    totalFiles++

    if (!existsSync(filePath)) {
      console.error(`    ❌ Missing: ${file}`)
      failures++
      continue
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      JSON.parse(content)
      console.log(`    ✓ ${file}`)
    } catch (err) {
      console.error(`    ❌ Invalid JSON: ${file} — ${(err as Error).message}`)
      failures++
    }
  }

  // Validate summary has required fields
  const summaryPath = join(scenarioDir, 'summary.json')
  if (existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'))
      const requiredFields = ['scenario', 'status', 'timestamp', 'trace_id']
      for (const field of requiredFields) {
        if (!(field in summary)) {
          console.error(`    ❌ summary.json missing field: ${field}`)
          failures++
        }
      }
    } catch { /* already reported above */ }
  }
}

console.log('\n───────────────────────────────────────────────────────────────')
if (failures === 0) {
  console.log(`  ✓ All ${totalFiles} artifacts verified across ${Object.keys(EXPECTED_SCENARIOS).length} scenarios`)
} else {
  console.error(`  ❌ ${failures} failure(s) found`)
}
console.log('═══════════════════════════════════════════════════════════════')

process.exit(failures > 0 ? 1 : 0)
