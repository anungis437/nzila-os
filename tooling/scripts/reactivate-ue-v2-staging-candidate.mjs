import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { candidateNeedsActivation } from './lib/ue-v2-connection-budget.mjs'

assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
const source = process.env.SOURCE_SHA
assert.match(source, /^[a-f0-9]{40}$/)
const manifest = JSON.parse(readFileSync(process.env.RELEASE_MANIFEST, 'utf8'))
assert.equal(manifest.sourceSha, source)
const change = JSON.parse(readFileSync('ops/change-records/CHG-2026-0114.json', 'utf8'))
assert.equal(change.approval_status, 'APPROVED'); assert.equal(change.founder_staging_authorization.candidate_sha, source)
assert.equal(change.founder_staging_authorization.production_authorized, false)
assert(Date.now() >= Date.parse(change.implementation_window_start) && Date.now() <= Date.parse(change.implementation_window_end))
execFileSync('git', ['merge-base', '--is-ancestor', source, process.env.GITHUB_SHA])
const az = args => {
  const output = execFileSync('az', [...args, '--subscription', 'd562ba7f-d891-4504-a489-10917c0ebaaf', '--only-show-errors', '-o', 'json'], { encoding: 'utf8', timeout: 120000 }).trim()
  return output ? JSON.parse(output) : null
}
const revisionName = 'nzila-ue-v2-staging-app--rel' + source.slice(0, 10)
const args = ['-g', 'nzila-canada-staging-rg', '-n', 'nzila-ue-v2-staging-app', '--revision', revisionName]
const before = az(['containerapp', 'revision', 'show', ...args])
const required = candidateNeedsActivation({ sourceSha: source, expectedImage: manifest.images.app.reference, revision: before })
if (required) {
  az(['containerapp', 'revision', 'activate', ...args])
  assert.equal(candidateNeedsActivation({ sourceSha: source, expectedImage: manifest.images.app.reference, revision: az(['containerapp', 'revision', 'show', ...args]) }), false)
}
const receipt = { status: 'PASS', sourceSha: source, workflowSha: process.env.GITHUB_SHA, revisionName, image: manifest.images.app.reference, reactivated: required, trafficChanged: false }
writeFileSync(process.env.ACTIVATION_RECEIPT, JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify(receipt))
