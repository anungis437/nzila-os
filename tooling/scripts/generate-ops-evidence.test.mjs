import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchBuildMetricsFromGitHub, requireFreshSource } from './generate-ops-evidence.mjs'

const now = Date.parse('2026-10-30T12:00:00.000Z')
const env = { GITHUB_TOKEN: 'test-only', GITHUB_REPOSITORY: 'nzila/test' }
const latest = new Date(now - 60 * 60000).toISOString()
const started = new Date(now - 90 * 60000).toISOString()

test('outdated DORA data cannot become new measured operational evidence', () => {
  const old = requireFreshSource({ collected_at: '2026-08-25T00:00:00Z', metrics: { a: 1 } }, 'DORA', now)
  assert.equal(old.data, null)
  assert.match(old.reason, /freshness window/)
  assert.ok(requireFreshSource({ collected_at: latest }, 'DORA', now).data)
})
test('absence of GitHub credentials yields unknown, not zero or fabricated PASS', async () => {
  const r = await fetchBuildMetricsFromGitHub({ env: {}, now })
  assert.equal(r.buildSuccessRate, null)
  assert.equal(r.medianBuildMinutes, null)
  assert.match(r.sourceNeeded, /GITHUB_TOKEN/)
})
test('provider outage reports source debt instead of breaking ops documentation', async () => {
  const r = await fetchBuildMetricsFromGitHub({
    env, now,
    httpGet: async () => { throw new TypeError('provider unavailable') },
  })
  assert.equal(r.buildSuccessRate, null)
  assert.equal(r.medianBuildMinutes, null)
  assert.match(r.sourceNeeded, /TypeError/)
})
test('invalid provider payload cannot create false metrics', async () => {
  const bad = await fetchBuildMetricsFromGitHub({
    env, now, httpGet: async () => ({ ok: true, json: async () => ({ workflow_runs: null }) }),
  })
  assert.equal(bad.buildSuccessRate, null)
  const denied = await fetchBuildMetricsFromGitHub({
    env, now, httpGet: async () => ({ ok: false, status: 403 }),
  })
  assert.equal(denied.buildSuccessRate, null)
})
test('only in-window completed CI runs count toward reliability', async () => {
  const r = await fetchBuildMetricsFromGitHub({
    env, now,
    httpGet: async () => ({ ok: true, json: async () => ({ workflow_runs: [
      { status: 'completed', conclusion: 'success', updated_at: latest, run_started_at: started },
      { status: 'completed', conclusion: 'failure', updated_at: latest, run_started_at: started },
      { status: 'in_progress', conclusion: null, updated_at: latest },
      { status: 'completed', conclusion: 'success', updated_at: '2026-08-01T00:00:00Z' },
    ] }) }),
  })
  assert.equal(r.buildSuccessRate, 50)
  assert.equal(r.medianBuildMinutes, 30)
  assert.match(r.source, /completed runs: 2/)
})
