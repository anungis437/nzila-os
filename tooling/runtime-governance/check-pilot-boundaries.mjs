#!/usr/bin/env node
/**
 * check-pilot-boundaries.mjs — Structural pilot-boundary validator.
 *
 * Reads `NZILA_PILOT_BOUNDARIES` (path to a JSON file) and validates:
 *   - Each pilot scope declares an `environmentClass` of `pilot`.
 *   - No pilot scope shares its `dataPartitionKey` with a production scope.
 *   - No pilot scope opts into production-only feature profiles.
 *
 * If the env var is unset, the script is a no-op (exit 0). This makes it
 * safe to run in environments that have not yet adopted pilot scoping.
 */
import { readFileSync } from 'node:fs'

const path = process.env.NZILA_PILOT_BOUNDARIES
if (!path) {
  process.stdout.write(
    'runtime-governance/check-pilot-boundaries: no NZILA_PILOT_BOUNDARIES set; skipping\n',
  )
  process.exit(0)
}

let raw
try {
  raw = readFileSync(path, 'utf8')
} catch (err) {
  process.stderr.write(
    `runtime-governance/check-pilot-boundaries: cannot read ${path}: ${err.message}\n`,
  )
  process.exit(2)
}

let doc
try {
  doc = JSON.parse(raw)
} catch (err) {
  process.stderr.write(
    `runtime-governance/check-pilot-boundaries: invalid JSON: ${err.message}\n`,
  )
  process.exit(2)
}

const errors = []
const productionPartitionKeys = new Set()
const pilotPartitionKeys = new Set()

for (const scope of doc.scopes ?? []) {
  if (scope.environmentClass === 'production') {
    productionPartitionKeys.add(scope.dataPartitionKey)
  }
}

for (const scope of doc.scopes ?? []) {
  if (scope.environmentClass !== 'pilot') continue
  if (!scope.dataPartitionKey) {
    errors.push(`pilot scope "${scope.id}" missing dataPartitionKey`)
    continue
  }
  if (productionPartitionKeys.has(scope.dataPartitionKey)) {
    errors.push(
      `pilot scope "${scope.id}" shares dataPartitionKey with a production scope`,
    )
  }
  if (pilotPartitionKeys.has(scope.dataPartitionKey)) {
    errors.push(
      `pilot scope "${scope.id}" reuses a dataPartitionKey already claimed by another pilot scope`,
    )
  }
  pilotPartitionKeys.add(scope.dataPartitionKey)

  for (const profile of scope.featureProfiles ?? []) {
    if (profile.startsWith('production:')) {
      errors.push(
        `pilot scope "${scope.id}" opts into production-only feature profile "${profile}"`,
      )
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(
    `runtime-governance/check-pilot-boundaries: refused\n${errors.map((e) => '  - ' + e).join('\n')}\n`,
  )
  process.exit(2)
}

process.stdout.write(
  `runtime-governance/check-pilot-boundaries: ok scopes=${(doc.scopes ?? []).length}\n`,
)
