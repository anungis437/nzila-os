// ---------------------------------------------------------------------------
// scripts/agri-final-lock-check.ts
//
// Combined lock gate — runs all four enforcement conditions in sequence.
// Exit code 0 only if every condition passes.
//
//   1. Shared-core enforcement   (scripts/agri-core-enforcement.ts)
//   2. Duplication report        (scripts/agri-duplication-report.ts)
//   3. Reporting schema check    (scripts/agri-reporting-schema-check.ts)
//   4. CoraGov ingestion check   (scripts/agri-ingestion-check.ts)
//
// Usage:  npx tsx scripts/agri-final-lock-check.ts
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

interface SubCheck {
  label: string
  script: string
}

const CHECKS: SubCheck[] = [
  { label: 'AGRI-LOCK-001 — Shared-core enforcement', script: 'scripts/agri-core-enforcement.ts' },
  { label: 'AGRI-LOCK-002 — Duplication report',       script: 'scripts/agri-duplication-report.ts' },
  { label: 'AGRI-LOCK-003 — Reporting schema check',   script: 'scripts/agri-reporting-schema-check.ts' },
  { label: 'AGRI-LOCK-004 — CoraGov ingestion check',  script: 'scripts/agri-ingestion-check.ts' },
]

let failures = 0

for (const check of CHECKS) {
  console.log(`\n════════ ${check.label} ════════`)
  try {
    execSync(`npx tsx ${check.script}`, {
      cwd: ROOT,
      stdio: 'inherit',
      timeout: 30_000,
    })
    console.log(`  ✓ ${check.label} — PASSED`)
  } catch {
    console.error(`  ✗ ${check.label} — FAILED`)
    failures++
  }
}

console.log('\n════════ Final Lock Summary ════════')
if (failures > 0) {
  console.error(`${failures} of ${CHECKS.length} check(s) failed — lock NOT secured.`)
  process.exit(1)
} else {
  console.log(`All ${CHECKS.length} checks passed — agri platform is locked. ✓`)
}
