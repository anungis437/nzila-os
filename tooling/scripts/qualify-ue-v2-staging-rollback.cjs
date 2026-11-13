// Protected main-only staging rehearsal. Only revision templates are changed;
// ingress stays pinned to the known-good revision. No secrets or data are changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const SUB = 'd562ba7f-d891-4504-a489-10917c0ebaaf';
const RG = 'nzila-canada-staging-rg', APP = 'nzila-ue-v2-staging-app';
const ID = '/subscriptions/' + SUB + '/resourceGroups/' + RG + '/providers/Microsoft.App/containerApps/' + APP;
const BASE = 'https://nzila-ue-v2-staging-app.whitemoss-055b7430.canadacentral.azurecontainerapps.io';
const OUT = 'artifacts/ue-v2-rollback';
const report = { sourceSha: process.env.SOURCE_SHA, workflowSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, evidenceClass: 'ACTUAL_STAGING_FAILED_REVISION_AND_KNOWN_GOOD_RECOVERY', observations: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function az(args) {
  const r = cp.spawnSync('az', args.concat(['--only-show-errors', '-o', 'json']), { encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(r.status, 0, 'Azure operation failed: ' + args.slice(0, 2).join(' '));
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}
function get(path = '') { return az(['rest', '--method', 'get', '--url', 'https://management.azure.com' + ID + path + '?api-version=2024-03-01']); }
function requirePinnedTraffic(app, known) {
  assert.equal(app.properties.configuration.activeRevisionsMode, 'Multiple');
  const traffic = app.properties.configuration.ingress.traffic;
  assert(Array.isArray(traffic) && traffic.length > 0, 'Explicit pinned traffic is required');
  assert(!traffic.some(route => route.latestRevision === true), 'Traffic must not follow latest revision');
  const serving = traffic.filter(route => route.weight > 0);
  assert.equal(serving.length, 1, 'One known-good revision must hold all traffic');
  assert.equal(serving[0].revisionName, known, 'Known-good traffic changed during rehearsal');
  assert.equal(serving[0].weight, 100);
}
function templateHash(template) {
  const copy = structuredClone(template); delete copy.revisionSuffix;
  // The app-level template echo and the per-revision snapshot differ in two cosmetic,
  // ARM-API-filled ways that carry no configuration meaning: a secretRef-bound env var gets an
  // empty "value" echoed back only at the app level, and ephemeralStorage is a default the app
  // level fills in that the revision snapshot omits. Strip both before comparing.
  for (const container of copy.containers ?? []) {
    for (const envVar of container.env ?? []) {
      if (envVar.secretRef) delete envVar.value;
    }
    if (container.resources) delete container.resources.ephemeralStorage;
  }
  const stable = x => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
  return crypto.createHash('sha256').update(JSON.stringify(stable(copy))).digest('hex');
}
async function healthy() {
  const response = await fetch(BASE + '/api/health/liveness', { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Known-good staging service must remain live');
  const version = await fetch(BASE + '/api/version', { signal: AbortSignal.timeout(20000) });
  assert.equal(version.status, 200); assert.equal((await version.json()).gitSha, report.sourceSha);
}
function patch(template, location) {
  // Body stays in memory; no environment values or secret references enter artifacts.
  return az(['rest', '--method', 'patch', '--url', 'https://management.azure.com' + ID + '?api-version=2024-03-01', '--body', JSON.stringify({ location, properties: { template } })]);
}
async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  const change = JSON.parse(fs.readFileSync('ops/change-records/CHG-2026-0114.json', 'utf8'));
  const auth = change.founder_staging_authorization;
  assert.equal(auth.candidate_sha, report.sourceSha); assert.equal(auth.subscription_id, SUB);
  assert.equal(auth.staging_only, true); assert.equal(auth.production_authorized, false);
  assert.equal(change.approval_status, 'APPROVED');
  assert(Date.now() >= Date.parse(change.implementation_window_start) && Date.now() <= Date.parse(change.implementation_window_end));
  cp.execFileSync('git', ['merge-base', '--is-ancestor', report.sourceSha, process.env.GITHUB_SHA]);
  const account = az(['account', 'show']);
  assert.equal(account.id, SUB);
  assert.equal(account.tenantId, 'cc15259a-d2bf-421f-8e44-dccf8dc6232a');
  const before = get();
  const serving = before.properties.configuration.ingress?.traffic?.filter(route => route.weight > 0);
  assert.equal(serving?.length, 1, 'One explicitly pinned healthy revision is required');
  const known = serving[0].revisionName;
  assert.equal(typeof known, 'string');
  requirePinnedTraffic(before, known);
  assert.equal(before.location.toLowerCase().replace(/\s+/g, ''), 'canadacentral');
  assert.equal(before.properties.latestReadyRevisionName, before.properties.latestRevisionName, 'The latest template must also have recovered before another rehearsal');
  const revision = get('/revisions/' + known);
  const original = structuredClone(revision.properties.template);
  assert.equal(templateHash(original), templateHash(before.properties.template));
  assert.equal(original.containers.length, 1);
  const image = original.containers[0].image;
  assert.match(image, /^nzilaventuresacr\.azurecr\.io\/nzila-os-union-eyes-v2@sha256:[a-f0-9]{64}$/);
  if (process.env.OPERATION === 'rehearse') {
    const reviewed = JSON.parse(fs.readFileSync('reviewed-plan/receipt.json', 'utf8'));
    assert.equal(reviewed.status, 'PLAN_PASS'); assert.equal(reviewed.sourceSha, report.sourceSha);
    assert.equal(reviewed.runId, report.runId); assert.equal(reviewed.before.revision, known);
    assert.equal(reviewed.before.latestRevision, before.properties.latestRevisionName);
    assert.equal(reviewed.before.image, image); assert.equal(reviewed.before.templateHash, templateHash(original));
  }
  assert(!original.containers[0].env.some(x => x.name === 'NODE_OPTIONS'), 'Unexpected existing Node options');
  await healthy();
  report.before = { revision: known, latestRevision: before.properties.latestRevisionName, image, templateHash: templateHash(original), mode: 'Multiple', trafficWeight: 100 };
  if (process.env.OPERATION === 'plan') { report.status = 'PLAN_PASS'; return; }
  assert.equal(process.env.OPERATION, 'rehearse');
  const suffix = String(process.env.GITHUB_RUN_ID); assert.match(suffix, /^\d+$/);
  const badName = APP + '--qa-fail-' + suffix, recoveredName = APP + '--qa-recover-' + suffix;
  let attempted = false, faultObserved = false;
  try {
    const latest = get(); requirePinnedTraffic(latest, known); assert.equal(latest.properties.latestRevisionName, report.before.latestRevision); assert.equal(templateHash(latest.properties.template), report.before.templateHash);
    const bad = structuredClone(original); bad.revisionSuffix = 'qa-fail-' + suffix;
    bad.containers[0].env.push({ name: 'NODE_OPTIONS', value: '--require=/ue-staging-intentionally-absent-' + suffix + '.cjs' });
    attempted = true; patch(bad, before.location);
    for (let i = 0; i < 36; i++) {
      const app = get(); assert.equal(app.properties.latestRevisionName, badName);
      requirePinnedTraffic(app, known); await healthy();
      const failed = get('/revisions/' + badName).properties;
      report.observations.push({ at: new Date().toISOString(), servingRevision: known, servingWeight: 100, failedRevision: badName, failedRevisionWeight: 0, provisioningState: failed.provisioningState, runningState: failed.runningState, healthState: failed.healthState });
      if (['Failed', 'Degraded'].includes(failed.runningState) || failed.provisioningState === 'Failed') { faultObserved = true; break; }
      await pause(10000);
    }
    assert(faultObserved, 'Actual failed revision was not observed');
  } finally {
    if (attempted) {
      const current = get();
      assert([known, badName].includes(current.properties.latestRevisionName), 'Concurrent revision change; preserve external work');
      const restored = structuredClone(original); restored.revisionSuffix = 'qa-recover-' + suffix;
      patch(restored, before.location);
      let ready = false;
      for (let i = 0; i < 48; i++) {
        const app = get();
        requirePinnedTraffic(app, known);
        assert.equal(app.properties.latestRevisionName, recoveredName);
        if (app.properties.latestReadyRevisionName === recoveredName) {
          const actual = get('/revisions/' + recoveredName).properties.template;
          assert.equal(templateHash(actual), report.before.templateHash);
          assert.equal(actual.containers[0].image, image); await healthy(); ready = true;
          report.recovered = { revision: recoveredName, image, templateHash: templateHash(actual), health: 'PASS', sourceIdentity: 'PASS', servingRevision: known, servingWeight: 100, recoveredRevisionWeight: 0 }; break;
        }
        await pause(10000);
      }
      assert(ready, 'Known-good recovery did not become ready');
      az(['containerapp', 'revision', 'deactivate', '--subscription', SUB, '-g', RG, '-n', APP, '--revision', badName]);
      report.failedRevisionDeactivated = true;
    }
  }
  assert(faultObserved); report.status = 'PASS';
}
main().catch(error => { report.status = 'FAIL'; report.failure = { error: error.name, assertion: error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'Operation failed' }; process.exitCode = 1; }).finally(() => {
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + '/receipt.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, sourceSha: report.sourceSha, recovered: !!report.recovered }));
});
