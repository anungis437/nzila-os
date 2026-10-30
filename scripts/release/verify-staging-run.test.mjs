import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyStagingRun } from './verify-staging-run.mjs'

const SHA = 'a'.repeat(40)
const RUN_ID = '123456'
function validRun() {
  return {
    databaseId: 123456,
    headSha: SHA,
    headBranch: 'main',
    workflowName: 'Deploy Staging',
    event: 'workflow_dispatch',
    conclusion: 'success',
    jobs: [{ name: 'Deploy to Staging', status: 'completed', conclusion: 'success' }],
  }
}

test('requires independently completed staging deployment for exact run', () => {
  assert.deepEqual(verifyStagingRun(validRun(), SHA, RUN_ID),
    { runId: RUN_ID, commitSha: SHA })
})
test('build-only push run cannot be used for production promotion', () => {
  const run = validRun()
  run.event = 'push'
  run.jobs[0].conclusion = 'skipped'
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /identity, dispatch/)
})
test('skipped or failed staging deployment cannot be promoted', () => {
  for (const conclusion of ['skipped', 'failure', 'cancelled', null]) {
    const run = validRun()
    run.jobs[0].conclusion = conclusion
    assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /successful real staging/)
  }
})
test('rejects wrong SHA, wrong run ID and wrong workflow identity', () => {
  const run = validRun()
  assert.throws(() => verifyStagingRun(run, 'b'.repeat(40), RUN_ID), /mismatch/)
  assert.throws(() => verifyStagingRun(run, SHA, '123457'), /mismatch/)
  run.workflowName = 'Other Workflow'
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /mismatch/)
})
test('rejects missing, duplicate and spoofed deployment job evidence', () => {
  const run = validRun()
  run.jobs = []
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /successful real staging/)
  run.jobs = [validRun().jobs[0], validRun().jobs[0]]
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /successful real staging/)
  run.jobs = [{ name: 'Build & Attest', status: 'completed', conclusion: 'success' }]
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /successful real staging/)
  run.jobs = null
  assert.throws(() => verifyStagingRun(run, SHA, RUN_ID), /evidence unavailable/)
})
