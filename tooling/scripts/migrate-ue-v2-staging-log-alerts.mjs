// Azure log-search alert scopes are immutable. Replace only reviewed, unchanged staging
// alert definitions; retain a restorable snapshot before any replacement. No workspace is mutated.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { migrationPlan, replaceReviewedAlerts, subscription, resourceGroup } from './lib/ue-v2-staging-log-alerts.mjs'

const args = Object.fromEntries(process.argv.slice(2).reduce((all, arg, i, list) => i % 2 ? all : [...all, [arg.replace(/^--/, ''), list[i + 1]]], []))
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const save = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n') }
const plan = migrationPlan(read(args['what-if']), process.env.SOURCE_SHA)
if (args.operation === 'plan') {
  save(args.output, plan)
  console.log(JSON.stringify({ status: 'PLAN_PASS', fingerprint: plan.fingerprint, replacements: plan.operations }))
} else {
  assert.equal(args.operation, 'apply')
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
  assert.deepEqual(plan, read(args['reviewed-plan']), 'The actual replacement plan must match the protected reviewed plan')
  const change = read('ops/change-records/CHG-2026-0114.json')
  assert.equal(change.approval_status, 'APPROVED'); assert.equal(change.founder_staging_authorization.candidate_sha, plan.sourceSha)
  assert.equal(change.founder_staging_authorization.staging_only, true); assert.equal(change.founder_staging_authorization.production_authorized, false)
  assert(Date.now() >= Date.parse(change.implementation_window_start) && Date.now() <= Date.parse(change.implementation_window_end))
  execFileSync('git', ['merge-base', '--is-ancestor', plan.sourceSha, process.env.GITHUB_SHA])
  const az = values => JSON.parse(execFileSync('az', [...values, '--only-show-errors', '-o', 'json'], { encoding: 'utf8', timeout: 120000 }))
  const account = az(['account', 'show'])
  assert.equal(account.id, subscription); assert.equal(account.tenantId, 'cc15259a-d2bf-421f-8e44-dccf8dc6232a')
  if (plan.operations === 0) {
    const result = await replaceReviewedAlerts(plan, {}, value => save(args.output, value))
    console.log(JSON.stringify({ status: result.status, fingerprint: result.planFingerprint, replacements: 0 }))
    process.exit(0)
  }
  const app = az(['containerapp', 'show', '--subscription', subscription, '-g', resourceGroup, '-n', 'nzila-ue-v2-staging-app'])
  assert.equal(app.properties.configuration.activeRevisionsMode, 'Multiple')
  assert.deepEqual(app.properties.configuration.ingress.traffic, [{ revisionName: process.env.EXPECTED_SERVING_REVISION, weight: 100 }])
  assert.match(process.env.EXPECTED_SERVING_REVISION, /^nzila-ue-v2-staging-app--rel[a-f0-9]{10}$/)
  const version = await fetch('https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io/api/version', { signal: AbortSignal.timeout(30000) })
  assert.equal(version.status, 200)
  assert.equal('nzila-ue-v2-staging-app--rel' + (await version.json()).gitSha.slice(0, 10), process.env.EXPECTED_SERVING_REVISION)
  const url = id => `https://management.azure.com${id}?api-version=2023-12-01`
  const api = {
    get: id => az(['rest', '--method', 'get', '--url', url(id)]),
    exists: id => {
      const result = spawnSync('az', ['rest', '--method', 'get', '--url', url(id), '--only-show-errors', '-o', 'json'], { encoding: 'utf8', timeout: 120000 })
      if (result.status === 0) return true
      assert.match(result.stderr, /ResourceNotFound|NotFound/, 'Alert existence could not be verified')
      return false
    },
    delete: id => execFileSync('az', ['rest', '--method', 'delete', '--url', url(id), '--only-show-errors'], { encoding: 'utf8', timeout: 120000 }),
    put: (id, value) => az(['rest', '--method', 'put', '--url', url(id), '--body', JSON.stringify(value)]),
  }
  const result = await replaceReviewedAlerts(plan, api, value => save(args.output, value))
  console.log(JSON.stringify({ status: result.status, fingerprint: result.planFingerprint, replacements: result.completed.length }))
}
