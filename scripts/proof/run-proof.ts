#!/usr/bin/env npx tsx
/**
 * Proof Runner — executes platform proof tests and generates artifacts.
 *
 * Usage:
 *   npx tsx scripts/proof/run-proof.ts                # Run all scenarios
 *   npx tsx scripts/proof/run-proof.ts ue-governed-mutation   # Run one scenario
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname2 = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname2, '..', '..')
const ARTIFACT_DIR = join(ROOT, 'proof-artifacts')

const ALL_SCENARIOS = [
  'ue-governed-mutation',
  'ai-controlled-request',
  'event-contract-flow',
  'compliance-sensitive-action',
]

const scenario = process.argv[2]

if (scenario && !ALL_SCENARIOS.includes(scenario)) {
  console.error(`Unknown scenario: ${scenario}`)
  console.error(`Available: ${ALL_SCENARIOS.join(', ')}`)
  process.exit(1)
}

const testFilter = scenario
  ? `--testPathPattern "${scenario}"`
  : ''

console.log('═══════════════════════════════════════════════════════════════')
console.log('  Platform Proof Runner')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`  Scenarios: ${scenario ?? 'ALL'}`)
console.log(`  Artifacts: ${ARTIFACT_DIR}`)
console.log('')

try {
  execSync(
    `npx vitest run --project e2e-platform ${testFilter}`,
    { cwd: ROOT, stdio: 'inherit' },
  )
} catch {
  console.error('\n❌ Proof tests failed. Artifacts may be incomplete.')
  process.exit(1)
}

// Build summary of all artifacts produced
console.log('\n───────────────────────────────────────────────────────────────')
console.log('  Proof Artifacts Generated')
console.log('───────────────────────────────────────────────────────────────')

if (!existsSync(ARTIFACT_DIR)) {
  console.log('  (no artifacts directory found)')
  process.exit(0)
}

const scenarios = readdirSync(ARTIFACT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

const summaries: Array<{ scenario: string; status: string; files: number }> = []

for (const dir of scenarios) {
  const scenarioDir = join(ARTIFACT_DIR, dir)
  const files = readdirSync(scenarioDir).filter(f => f.endsWith('.json'))
  const summaryPath = join(scenarioDir, 'summary.json')

  let status = 'unknown'
  if (existsSync(summaryPath)) {
    try {
      const data = JSON.parse(readFileSync(summaryPath, 'utf-8'))
      status = data.status ?? 'unknown'
    } catch { /* ignore parse errors */ }
  }

  summaries.push({ scenario: dir, status, files: files.length })
  console.log(`  ✓ ${dir}: ${files.length} artifacts (${status})`)
}

// Write latest proof summary
mkdirSync(ARTIFACT_DIR, { recursive: true })
const latestSummary = {
  timestamp: new Date().toISOString(),
  totalScenarios: summaries.length,
  allPassed: summaries.every(s => s.status === 'pass'),
  scenarios: summaries,
}
writeFileSync(
  join(ARTIFACT_DIR, 'latest-proof-summary.json'),
  JSON.stringify(latestSummary, null, 2) + '\n',
)

console.log('\n  → latest-proof-summary.json written')
console.log('═══════════════════════════════════════════════════════════════')
