import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { verifyStagingRun } from './verify-staging-run.mjs'

const SHA = 'a'.repeat(40)
const RUN_ID = '123456'
const WORKFLOW_ID = '789'
function validRun() {
  return {
    databaseId: 123456,
    workflowDatabaseId: 789,
    headSha: SHA,
    headBranch: 'main',
    workflowName: 'Deploy Staging',
    event: 'workflow_dispatch',
    conclusion: 'success',
    status: 'completed',
    attempt: 1,
    jobs: [{ name: 'Deploy to Staging', status: 'completed', conclusion: 'success',
      steps: [
        'Assert staging deployment identity is configured (fail-closed)',
        'Azure login (OIDC, staging-scoped)',
        'Staging boundary gate (fail-closed)',
        'Require real staging deployment implementation',
        'Run smoke tests',
        'Ingest Azure runtime evidence (live)',
      ].map(name => ({ name, status: 'completed', conclusion: 'success' })),
    },
      { name: 'Staging Pre-Deploy Gates', status: 'completed', conclusion: 'success' },
      { name: 'Build & Attest', status: 'completed', conclusion: 'success' },
    ],
  }
}

test('requires independently completed staging deployment for exact run', () => {
  assert.deepEqual(verifyStagingRun(validRun(), SHA, RUN_ID, WORKFLOW_ID),
    { runId: RUN_ID, commitSha: SHA })
})
test('a same-name but different workflow ID cannot substitute canonical staging', () => {
  const run = validRun()
  run.workflowDatabaseId = 790
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /mismatch/)
  assert.throws(() => verifyStagingRun(validRun(), SHA, RUN_ID, undefined),
    /missing trusted commit or run coordinate/)
})
test('unsafe or coerced GitHub staging coordinates cannot authorize promotion', () => {
  for (const value of ['9007199254740992','01','1e3',' 123456',0,-1]) {
    assert.throws(() => verifyStagingRun(validRun(), SHA, value, WORKFLOW_ID),
      /missing trusted commit or run coordinate/)
    assert.throws(() => verifyStagingRun(validRun(), SHA, RUN_ID, value),
      /missing trusted commit or run coordinate/)
  }
  for (const key of ['databaseId','workflowDatabaseId']) {
    for (const value of ['123456',null,Number.MAX_SAFE_INTEGER+1]) {
      const run=validRun();run[key]=value
      assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
        /staging workflow identity, dispatch or source commit mismatch/)
    }
  }
})
test('rerun cannot reuse an earlier staging deployment or artifact success', () => {
  for (const attempt of [2, 3, 0, null, undefined, '1']) {
    const run = validRun()
    run.attempt = attempt
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
      /rerun lacks independently attributable deployment evidence/)
  }
})
test('in-progress or cancelled staging run cannot be promoted', () => {
  for (const status of ['in_progress', 'queued', 'waiting', null, undefined]) {
    const run = validRun()
    run.status = status
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
      /identity, dispatch or source commit mismatch/)
  }
})
test('build-only push run cannot be used for production promotion', () => {
  const run = validRun()
  run.event = 'push'
  run.jobs[0].conclusion = 'skipped'
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /identity, dispatch/)
})
test('skipped or failed staging deployment cannot be promoted', () => {
  for (const conclusion of ['skipped', 'failure', 'cancelled', null]) {
    const run = validRun()
    run.jobs[0].conclusion = conclusion
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /successful real staging/)
  }
})
test('rejects wrong SHA, wrong run ID and wrong workflow identity', () => {
  const run = validRun()
  assert.throws(() => verifyStagingRun(run, 'b'.repeat(40), RUN_ID, WORKFLOW_ID), /mismatch/)
  assert.throws(() => verifyStagingRun(run, SHA, '123457', WORKFLOW_ID), /mismatch/)
  run.workflowName = 'Other Workflow'
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /mismatch/)
})
test('rejects missing, duplicate and spoofed deployment job evidence', () => {
  const run = validRun()
  run.jobs = []
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /successful real staging/)
  run.jobs = [validRun().jobs[0], validRun().jobs[0]]
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /successful real staging/)
  run.jobs = [{ name: 'Build & Attest', status: 'completed', conclusion: 'success' }]
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /successful real staging/)
  run.jobs = null
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID), /evidence unavailable/)
})

test('a green staging job without independently completed deployment and runtime steps is denied', () => {
  const names = [
    'Assert staging deployment identity is configured (fail-closed)',
    'Azure login (OIDC, staging-scoped)',
    'Staging boundary gate (fail-closed)',
    'Require real staging deployment implementation',
    'Run smoke tests',
    'Ingest Azure runtime evidence (live)',
  ]
  for (const name of names) {
    const run = validRun()
    run.jobs[0].steps = run.jobs[0].steps.filter(step => step.name !== name)
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
      /staging deployment and live runtime verification steps/, name)
  }
})
test('skipped, failed, duplicate or absent runtime step evidence cannot promote', () => {
  for (const state of ['skipped', 'failure', 'cancelled', null]) {
    const run = validRun()
    run.jobs[0].steps[4].conclusion = state
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
      /staging deployment and live runtime verification steps/)
  }
  const duplicate = validRun()
  duplicate.jobs[0].steps.push({ ...duplicate.jobs[0].steps[2] })
  assert.throws(() => verifyStagingRun(duplicate, SHA, RUN_ID, WORKFLOW_ID),
    /staging deployment and live runtime verification steps/)
  const absent = validRun()
  delete absent.jobs[0].steps
  assert.throws(() => verifyStagingRun(absent, SHA, RUN_ID, WORKFLOW_ID),
    /staging deployment and live runtime verification steps/)
})


test('green deploy cannot substitute missing, skipped or duplicate prerequisite jobs', () => {
  for (const name of ['Staging Pre-Deploy Gates', 'Build & Attest']) {
    const missing = validRun()
    missing.jobs = missing.jobs.filter(job => job.name !== name)
    assert.throws(() => verifyStagingRun(missing, SHA, RUN_ID, WORKFLOW_ID), /staging prerequisite gate/)
    for (const conclusion of ['skipped', 'failure', 'cancelled', null]) {
      const invalid = validRun()
      invalid.jobs.find(job => job.name === name).conclusion = conclusion
      assert.throws(() => verifyStagingRun(invalid, SHA, RUN_ID, WORKFLOW_ID), /staging prerequisite gate/)
    }
    const duplicate = validRun()
    duplicate.jobs.push({ ...duplicate.jobs.find(job => job.name === name) })
    assert.throws(() => verifyStagingRun(duplicate, SHA, RUN_ID, WORKFLOW_ID), /staging prerequisite gate/)
  }
})

test('smoke and runtime evidence must follow deployment in staging execution order', () => {
  for (const [first, second] of [[2, 3], [3, 4], [4, 5]]) {
    const run = validRun()
    const steps = run.jobs[0].steps
    ;[steps[first], steps[second]] = [steps[second], steps[first]]
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID, WORKFLOW_ID),
      /staging deployment and live runtime verification steps/)
  }
})

test('staging release snapshot must not fabricate independent policy verification', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy-staging.yml', import.meta.url), 'utf8')
  assert.match(workflow, /"policy_engine_status": "not_independently_attested"/)
  assert.doesNotMatch(workflow, /"policy_engine_status": "pass"/)
})
