// Bounded staging maintenance: deactivate zero-traffic history, never delete it.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const cp = require('node:child_process')
const SUB = 'd562ba7f-d891-4504-a489-10917c0ebaaf'
const RG = 'nzila-canada-staging-rg'
const APP = 'nzila-ue-v2-staging-app'
const BASE = 'https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io'
function az(args) {
  const result = cp.spawnSync('az', [...args, '--subscription', SUB, '--only-show-errors', '-o', 'json'], { encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024 })
  assert.equal(result.status, 0, 'Staging revision operation failed: ' + args.slice(0, 3).join(' '))
  return result.stdout.trim() ? JSON.parse(result.stdout) : null
}
async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true')
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main')
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted')
  const source = process.env.SOURCE_SHA
  assert.match(source, /^[a-f0-9]{40}$/)
  const change = JSON.parse(fs.readFileSync('ops/change-records/CHG-2026-0114.json', 'utf8'))
  assert.equal(change.approval_status, 'APPROVED')
  assert.equal(change.founder_staging_authorization.candidate_sha, source)
  assert.equal(change.founder_staging_authorization.subscription_id, SUB)
  assert.equal(change.founder_staging_authorization.staging_only, true)
  assert.equal(change.founder_staging_authorization.production_authorized, false)
  assert(Date.now() >= Date.parse(change.implementation_window_start) && Date.now() <= Date.parse(change.implementation_window_end))
  cp.execFileSync('git', ['merge-base', '--is-ancestor', source, process.env.GITHUB_SHA])
  const expected = process.env.EXPECTED_SERVING_REVISION
  const output = process.env.RETIREMENT_RECEIPT
  assert(output && expected?.startsWith(APP + '--'))
  const account = az(['account', 'show'])
  assert.equal(account.id, SUB)
  const { retirementTargets } = await import('./lib/ue-v2-connection-budget.mjs')
  const snapshot = () => {
    const app = az(['containerapp', 'show', '-g', RG, '-n', APP, '--query', '{mode:properties.configuration.activeRevisionsMode,traffic:properties.configuration.ingress.traffic}'])
    const revisions = az(['containerapp', 'revision', 'list', '-g', RG, '-n', APP, '--all', '--query', '[].{name:name,active:properties.active,trafficWeight:properties.trafficWeight}'])
    const targets = retirementTargets({ ...app, revisions, expectedServingRevision: expected })
    return { ...app, revisions, targets }
  }
  const response = await fetch(BASE + '/api/version', { signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const liveSource = (await response.json()).gitSha
  assert.match(liveSource, /^[a-f0-9]{40}$/)
  if (process.env.REQUIRE_CANDIDATE_SOURCE === 'true') assert.equal(liveSource, source)
  cp.execFileSync('git', ['merge-base', '--is-ancestor', liveSource, process.env.GITHUB_SHA])
  const ready = await fetch(BASE + '/api/ready', { signal: AbortSignal.timeout(20000) })
  assert.equal(ready.status, 200)
  assert.equal((await ready.json()).gitSha, liveSource)
  const before = snapshot()
  const report = { status: 'IN_PROGRESS', sourceSha: source, observedServingSourceSha: liveSource, workflowSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, servingRevision: expected, at: new Date().toISOString(), before, deactivated: [], revisionMetadataDeleted: false, databaseDataChanged: false, productionAuthorized: false }
  const persist = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  persist()
  if (before.targets.length) await new Promise(resolve => setTimeout(resolve, 60000))
  for (const name of before.targets) {
    assert(new RegExp('^' + APP + '--[a-z0-9-]+$').test(name))
    // A concurrent external promotion stops maintenance before another mutation.
    assert(snapshot().targets.includes(name))
    az(['containerapp', 'revision', 'deactivate', '-g', RG, '-n', APP, '--revision', name])
    report.deactivated.push(name)
    persist()
  }
  report.after = snapshot()
  assert.equal(report.after.targets.length, 0)
  report.status = 'PASS'
  report.finishedAt = new Date().toISOString()
  persist()
  console.log(JSON.stringify({ status: 'PASS', servingRevision: expected, deactivated: report.deactivated.length, revisionMetadataDeleted: false, databaseDataChanged: false }))
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', message: error.message })); process.exitCode = 1 })
