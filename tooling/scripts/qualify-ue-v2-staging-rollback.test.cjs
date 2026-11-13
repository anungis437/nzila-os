const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SOURCE = 'a'.repeat(40), APP = 'nzila-ue-v2-staging-app';
const SUB = 'd562ba7f-d891-4504-a489-10917c0ebaaf';
const code = fs.readFileSync(__dirname + '/qualify-ue-v2-staging-rollback.cjs', 'utf8');
async function simulate({ operation = 'rehearse', source = SOURCE, failHealthAfterPatch = false, concurrentRevision = false, unsafeLatestTraffic = false, trafficMovesToFailed = false } = {}) {
  const original = { revisionSuffix: 'good', containers: [{ name: 'app', image: 'nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:' + 'b'.repeat(64), env: [{ name: 'AUTH_SECRET', secretRef: 'auth-secret' }] }], scale: { minReplicas: 1 } };
  let app = { location: 'canadacentral', properties: { latestRevisionName: APP + '--good', latestReadyRevisionName: APP + '--good', configuration: { activeRevisionsMode: 'Multiple', ingress: {traffic: [{revisionName: APP + '--good', weight: 100, ...(unsafeLatestTraffic ? {latestRevision: true} : {})}]} }, template: structuredClone(original) } };
  const patches = [], receipts = {};
  let injected = false, reviewed;
  const change = { approval_status: 'APPROVED', implementation_window_start: '2020-01-01', implementation_window_end: '2100-01-01', founder_staging_authorization: { candidate_sha: SOURCE, subscription_id: SUB, staging_only: true, production_authorized: false } };
  const fakeFs = {
    readFileSync: path => JSON.stringify(path === 'reviewed-plan/receipt.json' ? reviewed : change), mkdirSync() {},
    writeFileSync: (path, body) => { receipts[path] = JSON.parse(body); },
  };
  const fakeCp = {
    execFileSync() {},
    spawnSync: (_command, args) => {
      let result;
      if (args[0] === 'account') result = { id: SUB, tenantId: 'cc15259a-d2bf-421f-8e44-dccf8dc6232a' };
      else if (args[0] === 'containerapp') result = null;
      else if (args[args.indexOf('--method') + 1] === 'patch') {
        const body = JSON.parse(args[args.indexOf('--body') + 1]);
        assert.deepEqual(Object.keys(body).sort(), ['location', 'properties']);
        assert.deepEqual(Object.keys(body.properties), ['template']);
        patches.push(body); app.properties.template = structuredClone(body.properties.template);
        app.properties.latestRevisionName = APP + '--' + body.properties.template.revisionSuffix;
        if (body.properties.template.revisionSuffix.startsWith('qa-recover-')) app.properties.latestReadyRevisionName = app.properties.latestRevisionName;
        result = app;
      } else if (args[args.indexOf('--url') + 1].includes('/revisions/')) {
        result = { properties: { template: structuredClone(app.properties.template), runningState: patches.length === 1 ? 'Failed' : 'Running', provisioningState: patches.length === 1 ? 'Failed' : 'Provisioned' } };
      } else {
        result = structuredClone(app);
        if (trafficMovesToFailed && patches.length === 1) result.properties.configuration.ingress.traffic = [{revisionName: app.properties.latestRevisionName, weight: 100}];
        if (concurrentRevision && patches.length === 0 && reviewed) result.properties.latestRevisionName = APP + '--external';
      }
      return { status: 0, stdout: JSON.stringify(result) };
    },
  };
  const run = async mode => {
    const processMock = { env: { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', RUNNER_ENVIRONMENT: 'github-hosted', GITHUB_SHA: 'c'.repeat(40), GITHUB_RUN_ID: '12345', SOURCE_SHA: source, OPERATION: mode } };
    const ctx = vm.createContext({ require: name => name === 'node:fs' ? fakeFs : name === 'node:child_process' ? fakeCp : require(name), process: processMock,
      structuredClone, console: { log() {} }, setTimeout, AbortSignal,
      fetch: async url => {
        if (failHealthAfterPatch && patches.length === 1 && !injected) { injected = true; return { status: 503 }; }
        return { status: 200, json: async () => ({ gitSha: source }) };
      } });
    await vm.runInContext(code, ctx);
    return receipts['artifacts/ue-v2-rollback/receipt.json'];
  };
  reviewed = await run('plan');
  if (operation === 'plan' || reviewed.status !== 'PLAN_PASS') return { report: reviewed, patches };
  return { report: await run('rehearse'), patches, original };
}
test('plan is read-only and captures the exact known-good image and revision', async () => {
  const { report, patches } = await simulate({ operation: 'plan' }); assert.equal(report.status, 'PLAN_PASS'); assert.equal(patches.length, 0);
});
test('rehearsal observes a real failure state and restores the exact captured template', async () => {
  const { report, patches, original } = await simulate(); assert.equal(report.status, 'PASS'); assert.equal(patches.length, 2);
  assert.equal(patches[0].properties.template.containers[0].env.at(-1).name, 'NODE_OPTIONS');
  const restored = structuredClone(patches[1].properties.template); restored.revisionSuffix = original.revisionSuffix;
  assert.deepEqual(restored, original); assert.equal(report.recovered.templateHash, report.before.templateHash);
  assert.equal(report.recovered.servingRevision, APP + '--good');
  assert.equal(report.recovered.servingWeight, 100);
  assert.equal(report.recovered.recoveredRevisionWeight, 0);
  assert.equal(report.failedRevisionDeactivated, true);
  assert(!JSON.stringify(report).includes('auth-secret'));
});
test('latest-following traffic is refused before fault injection', async () => {
  const {report, patches} = await simulate({unsafeLatestTraffic: true});
  assert.equal(report.status, 'FAIL'); assert.equal(patches.length, 0);
});
test('any observed traffic on the failed revision prevents an acceptance pass', async () => {
  const {report, patches} = await simulate({trafficMovesToFailed: true});
  assert.equal(report.status, 'FAIL'); assert.equal(patches.length, 2);
  assert(report.recovered);
});
test('a failed public health assertion still restores known-good and reports failure', async () => {
  const { report, patches } = await simulate({ failHealthAfterPatch: true }); assert.equal(report.status, 'FAIL'); assert.equal(patches.length, 2); assert(report.recovered);
});
test('wrong candidate and stale reviewed revision fail before any mutation', async () => {
  for (const options of [{ source: 'd'.repeat(40) }, { concurrentRevision: true }]) {
    const { report, patches } = await simulate(options); assert.equal(report.status, 'FAIL'); assert.equal(patches.length, 0);
  }
});
