import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveProductionReleaseRef } from './resolve-production-release-ref.mjs'

const sha = 'a'.repeat(40)
const repository = 'anungis437/nzila-os'
const base = { ref: 'refs/heads/main', eventName: 'workflow_dispatch', runId: '12345', sha, repository }

test('manual production dispatch uses a safe, run-scoped identity, never a branch path or fictitious tag', () => {
  const result = resolveProductionReleaseRef(base)
  assert.deepEqual(result, {
    releaseRef: 'dispatch-12345',
    version: '0.0.0-dispatch.12345',
    trigger: 'workflow_dispatch',
    changelogUrl: 'https://github.com/anungis437/nzila-os/actions/runs/12345',
  })
  assert.match(result.releaseRef, /^[a-z0-9.-]+$/)
  assert.doesNotMatch(result.releaseRef, /\//)
})

test('signed production tag push preserves the existing semver release identity', () => {
  const result = resolveProductionReleaseRef({ ...base, ref: 'refs/tags/v1.24.3', eventName: 'push' })
  assert.deepEqual(result, {
    releaseRef: 'v1.24.3',
    version: '1.24.3',
    trigger: 'push',
    changelogUrl: 'https://github.com/anungis437/nzila-os/releases/tag/v1.24.3',
  })
})

test('untrusted event, ref, run ID, SHA and repository coordinates fail closed', () => {
  for (const change of [
    {ref:'refs/heads/feature/unsafe'}, {ref:'refs/heads/main',eventName:'push'},
    {ref:'refs/tags/v1.2.3',eventName:'workflow_dispatch'},
    {ref:'refs/tags/v1.2.3/../../escape',eventName:'push'},
    {ref:'refs/tags/v1.2.3-rc.1',eventName:'push'},
    {runId:'0'}, {runId:'01'}, {runId:'1/../../bad'},
    {runId:'9007199254740992'}, {runId:'NaN'}, {sha:'x'.repeat(40)},
    {repository:'bad/repo/../escape'}, {repository:'bad repo/name'},
  ]) {
    assert.throws(() => resolveProductionReleaseRef({...base,...change}), /PRODUCTION_RELEASE_REF_DENIED/)
  }
})

test('CLI exposes only validated JSON and returns nonzero for untrusted refs', () => {
  const cli = fileURLToPath(new URL('./resolve-production-release-ref.mjs', import.meta.url))
  const args = [cli,base.ref,base.eventName,base.runId,base.sha,base.repository]
  const ok = spawnSync(process.execPath,args,{encoding:'utf8'})
  assert.equal(ok.status,0,ok.stderr)
  assert.equal(JSON.parse(ok.stdout).releaseRef,'dispatch-12345')
  const rejected = spawnSync(process.execPath,[cli,'refs/heads/unsafe',...args.slice(2)],{encoding:'utf8'})
  assert.notEqual(rejected.status,0)
  assert.match(rejected.stderr,/PRODUCTION_RELEASE_REF_DENIED/)
})

test('production evidence workflow consumes validated release identity for both tag and dispatch', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-production.yml',import.meta.url),'utf8')
  assert.match(workflow,/node scripts\/release\/resolve-production-release-ref\.mjs/)
  assert.match(workflow,/release-\$\{RELEASE_REF\}\.json/)
  assert.match(workflow,/change_record_ref.*\$RELEASE_REF/)
  assert.doesNotMatch(workflow,/TAG_NAME="\$\{GITHUB_REF#refs\/tags\/\}"/)
  assert.doesNotMatch(workflow,/release-\$\{TAG_NAME\}\.json/)
})
