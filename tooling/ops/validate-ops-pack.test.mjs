import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
// The ops validator is a TS module in a CJS-scoped tooling package.
// Node + tsx exposes its exported bindings via the default CJS namespace.
import * as opsValidator from './validate-ops-pack.ts'
const validateOpsPack = opsValidator.validateOpsPack ?? opsValidator.default?.validateOpsPack
if (typeof validateOpsPack !== 'function') throw new Error('Ops validator export unavailable')

const required = [
  'ops/runbooks/README.md', 'ops/oncall/README.md', 'ops/incident-response/README.md',
  'ops/disaster-recovery/README.md', 'ops/business-continuity/README.md',
  'ops/compliance/README.md', 'ops/change-management/README.md',
  'ops/security-operations/README.md', 'ARCHITECTURE.md', 'SECURITY.md',
]
const keys = [
  'deploy_frequency_30d', 'build_success_rate_30d', 'median_build_minutes',
  'change_failure_rate_30d', 'mttr_minutes', 'uptime_30d',
  'p50_latency_ms', 'p95_latency_ms', 'auth_success_rate',
  'error_rate', 'monthly_infra_cost_estimate', 'incidents_last_30d',
]
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nzila-ops-test-'))
  for (const path of required) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), ('Operational process procedure with roles and recovery evidence. ').repeat(70))
  }
  const metrics = Object.fromEntries(keys.map(k => [k, {
    value: null, source: 'Runtime source not connected',
    source_needed: 'Connect authenticated source before release',
  }]))
  const snapshot = { _meta: { generated_at: new Date().toISOString() }, metrics }
  const persist = () => {
    mkdirSync(join(root, 'reports/ops'), { recursive: true })
    writeFileSync(join(root, 'reports/ops/snapshot.json'), JSON.stringify(snapshot))
  }
  persist()
  return { root, snapshot, persist, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
test('missing observations are explicit unknown without fake health values', () => {
  const x = fixture()
  try { assert.equal(validateOpsPack(x.root).passed, true) } finally { x.cleanup() }
})
test('a fresh wrapper cannot launder a 2-month-old DORA measurement', () => {
  const x = fixture()
  try {
    mkdirSync(join(x.root, 'ops/outputs'), { recursive: true })
    writeFileSync(join(x.root, 'ops/outputs/dora-metrics.json'),
      JSON.stringify({ collected_at: '2026-08-25T00:00:00Z' }))
    x.snapshot.metrics.deploy_frequency_30d = {
      value: 9, source: 'ops/outputs/dora-metrics.json: metrics.deployment_frequency.value',
      source_needed: null,
    }
    x.persist()
    const r = validateOpsPack(x.root)
    assert.equal(r.passed, false)
    assert.ok(r.errors.some(e => e.includes('Source observation') && e.includes('deploy_frequency_30d')))
  } finally { x.cleanup() }
})
test('fresh collected_at allows measured value but not fabricated provenance', () => {
  const x = fixture()
  try {
    mkdirSync(join(x.root, 'ops/outputs'), { recursive: true })
    writeFileSync(join(x.root, 'ops/outputs/cost-allocation.json'),
      JSON.stringify({ collected_at: new Date().toISOString() }))
    x.snapshot.metrics.monthly_infra_cost_estimate = {
      value: 123, source: 'ops/outputs/cost-allocation.json: total_monthly_cost_usd',
      source_needed: null,
    }
    x.persist()
    assert.equal(validateOpsPack(x.root).passed, true)
  } finally { x.cleanup() }
})
test('source file absence fails rather than assuming data was verified', () => {
  const x = fixture()
  try {
    x.snapshot.metrics.monthly_infra_cost_estimate = {
      value: 123, source: 'ops/outputs/cost-allocation.json: total_monthly_cost_usd',
      source_needed: null,
    }
    x.persist()
    assert.equal(validateOpsPack(x.root).passed, false)
  } finally { x.cleanup() }
})
