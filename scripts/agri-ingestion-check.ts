// ---------------------------------------------------------------------------
// scripts/agri-ingestion-check.ts
//
// Validates that CoraGov ingestion works end-to-end for all valid fixtures.
// Loads each valid fixture, transforms it through the full pipeline
// (canonical → dataset → payload → harness), and verifies acceptance.
//
// Usage:  npx tsx scripts/agri-ingestion-check.ts
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalReportSchema } from '../packages/agri-reporting/src/canonical-reporting-schema.js'
import {
  canonicalToCoraGovDataset,
  coraGovDatasetSchema,
  coraGovPayloadSchema,
  CANONICAL_SECTIONS,
} from '../packages/agri-reporting/src/coragov-ingestion-contract.js'
import { simulateCoraGovIngestion } from '../packages/agri-reporting/src/coragov-ingestion-harness.js'

const __dirname = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const FIXTURE_DIR = resolve(ROOT, 'fixtures/agri/coragov')

const VALID_FIXTURES = [
  'cora-valid.json',
  'agrimo-valid.json',
  'cora-valid-full.json',
  'agrimo-valid-full.json',
]

const INVALID_FIXTURES = [
  'invalid-source.json',
  'malformed-payload.json',
  'invalid-missing-provenance.json',
  'invalid-schema-drift.json',
]

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// ── Check 1: All valid fixtures pass canonical + dataset + harness ────────

console.log('\n── INGESTION-001: Valid fixture pipeline ──')

for (const name of VALID_FIXTURES) {
  const raw = JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8'))

  const canonical = canonicalReportSchema.safeParse(raw)
  check(`${name} canonical parse`, canonical.success)
  if (!canonical.success) continue

  const dataset = canonicalToCoraGovDataset(canonical.data)
  const dsValid = coraGovDatasetSchema.safeParse(dataset)
  check(`${name} dataset schema`, dsValid.success)

  const payload = {
    batch_id: `cgov_check_${name}`,
    submitted_at: new Date().toISOString(),
    source_app: canonical.data.source_app,
    datasets: [dataset],
  }

  const payloadValid = coraGovPayloadSchema.safeParse(payload)
  check(`${name} payload schema`, payloadValid.success)

  const result = simulateCoraGovIngestion(JSON.parse(JSON.stringify(payload)))
  check(`${name} harness accepts`, result.accepted)
}

// ── Check 2: All invalid fixtures are rejected by canonical schema ───────

console.log('\n── INGESTION-002: Invalid fixture rejection ──')

for (const name of INVALID_FIXTURES) {
  const raw = JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8'))
  const result = canonicalReportSchema.safeParse(raw)
  check(`${name} rejected`, !result.success)
}

// ── Check 3: Full fixtures exercise all 5 sections ───────────────────────

console.log('\n── INGESTION-003: Full section coverage ──')

for (const name of ['cora-valid-full.json', 'agrimo-valid-full.json']) {
  const report = canonicalReportSchema.parse(
    JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8')),
  )
  const dataset = canonicalToCoraGovDataset(report)

  for (const section of CANONICAL_SECTIONS) {
    check(`${name} has ${section}`, dataset[section].length > 0)
  }
}

// ── Check 4: Fixture directory contains expected files ───────────────────

console.log('\n── INGESTION-004: Fixture inventory ──')

const allFixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))
const expected = [...VALID_FIXTURES, ...INVALID_FIXTURES]
for (const name of expected) {
  check(`fixture exists: ${name}`, allFixtures.includes(name))
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n── Ingestion check: ${passed} passed, ${failed} failed ──`)
if (failed > 0) {
  process.exit(1)
}
