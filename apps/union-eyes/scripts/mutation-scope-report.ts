/**
 * Prints the unscoped UPDATE/DELETE candidates in the current tree against the committed baseline.
 * Usage: npx tsx scripts/mutation-scope-report.ts [pathPrefix]
 * Read-only: it never rewrites the baseline (the integrator regenerates it with UE_MUTATION_SCOPE_WRITE=1).
 */
import { readFileSync } from 'node:fs'
import { BASELINE, scanUnscopedMutations } from './lib/mutation-scope-scan'

const prefix = process.argv[2] ?? ''
const current = scanUnscopedMutations()
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).entries as Record<string, number>
const keys = [...new Set([...Object.keys(current), ...Object.keys(baseline)])].filter((k) => k.startsWith(prefix)).sort()
let remaining = 0
let baselineTotal = 0
for (const key of keys) {
  const now = current[key] ?? 0
  const was = baseline[key] ?? 0
  remaining += now
  baselineTotal += was
  const flag = now > was ? 'REGRESSION' : now < was ? 'reduced' : 'open'
  console.log(`${flag.padEnd(10)} now=${now} baseline=${was}  ${key}`)
}
console.log(`total now=${remaining} baseline=${baselineTotal} (prefix '${prefix}')`)
