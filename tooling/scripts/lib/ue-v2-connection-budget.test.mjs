import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { evaluateStagingConnectionBudget, retirementTargets, candidateNeedsActivation } from './ue-v2-connection-budget.mjs'

const policy = JSON.parse(readFileSync(new URL('../../../infrastructure/bicep/ue-v2/staging-connection-budget.json', import.meta.url)))
const baseline = { policy, maxConnections: 50, reservedConnections: 5, superuserReservedConnections: 10, maximumReplicas: 2 }
test('both rollout revisions and maximum replicas fit the observed server with operator headroom', () => {
  assert.deepEqual(evaluateStagingConnectionBudget(baseline), { ok: true, defects: [], maxConnections: 50, reservedConnections: 5, superuserReservedConnections: 10, ordinarySlots: 35, connectionsPerProcess: 7, maximumRolloutReplicas: 4, maximumApplicationConnections: 28, ordinaryConnectionHeadroom: 7 })
})
test('the actual previous independent pool defaults fail the connection budget', () => {
  const previous = { ...policy, poolCaps: { DB_POOL_MAX: 10, DATABASE_POOL_SIZE: 20, SYSTEM_DB_POOL_MAX: 5, AUTH_DB_POOL_MAX: 5, AUTH_SYSTEM_DB_POOL_MAX: 5 } }
  assert.equal(evaluateStagingConnectionBudget({ ...baseline, policy: previous }).ok, false)
})
test('reserved-slot growth, replica growth and missing or invalid caps fail closed', () => {
  for (const change of [{ reservedConnections: 6 }, { maximumReplicas: 3 }, { maxConnections: 49 }]) assert.equal(evaluateStagingConnectionBudget({ ...baseline, ...change }).ok, false)
  for (const value of [0, -1, 1.5, '1', undefined]) assert.equal(evaluateStagingConnectionBudget({ ...baseline, policy: { ...policy, poolCaps: { ...policy.poolCaps, AUTH_DB_POOL_MAX: value } } }).ok, false)
})
test('Bicep installs the budgeted caps for every distinct staging pool family', () => {
  const bicep = readFileSync(new URL('../../../infrastructure/bicep/ue-v2/modules/apps.bicep', import.meta.url), 'utf8')
  for (const name of Object.keys(policy.poolCaps)) assert(bicep.includes("{ name: '" + name + "', value: string(runtimePoolLimits." + name + ") }"))
  assert(bicep.includes("loadJsonContent('../staging-connection-budget.json')"))
})
const current = 'nzila-ue-v2-staging-app--current'
const old = 'nzila-ue-v2-staging-app--old'
const retirement = { mode: 'Multiple', traffic: [{ revisionName: current, weight: 100 }], expectedServingRevision: current, revisions: [{ name: current, active: true, trafficWeight: 100 }, { name: old, active: true, trafficWeight: 0 }, { name: 'retained-inactive', active: false, trafficWeight: 0 }] }
test('retirement selects only active zero-traffic history and retains inactive metadata', () => assert.deepEqual(retirementTargets(retirement), [old]))
test('retirement refuses changed, split, latest-based or inactive serving traffic', () => {
  for (const change of [{ expectedServingRevision: old }, { traffic: [{ latestRevision: true, weight: 100 }] }, { traffic: [{ revisionName: current, weight: 90 }, { revisionName: old, weight: 10 }] }, { revisions: [{ name: current, active: false, trafficWeight: 100 }] }]) assert.throws(() => retirementTargets({ ...retirement, ...change }))
})

test('a partial-apply retry can reactivate only its retained exact-source exact-image candidate', () => {
  const sourceSha = '9a7ee373e1205209f864e63f37877c8919bb6738'
  const expectedImage = 'nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:' + 'a'.repeat(64)
  const revision = { name: 'nzila-ue-v2-staging-app--rel9a7ee373e1', properties: { active: false, template: { containers: [{ image: expectedImage }] } } }
  assert.equal(candidateNeedsActivation({ sourceSha, expectedImage, revision }), true)
  assert.equal(candidateNeedsActivation({ sourceSha, expectedImage, revision: { ...revision, properties: { ...revision.properties, active: true } } }), false)
  assert.throws(() => candidateNeedsActivation({ sourceSha, expectedImage, revision: { ...revision, name: old } }), /WRONG_CANDIDATE_REVISION/)
  assert.throws(() => candidateNeedsActivation({ sourceSha, expectedImage: expectedImage.replace(/a{64}$/, 'b'.repeat(64)), revision }), /WRONG_CANDIDATE_IMAGE/)
  const workflow = readFileSync(new URL('../../../.github/workflows/ue-v2-staging-deploy.yml', import.meta.url), 'utf8').split('\n  apply:\n')[1]
  assert(workflow.indexOf('Recheck the actual PostgreSQL connection budget') < workflow.indexOf('Reactivate the exact retained candidate'))
  assert(workflow.indexOf('Reactivate the exact retained candidate') < workflow.indexOf('Promote traffic to the new revision'))
})


test('the deployment checkout retains the source and serving history required by retirement ancestry guards', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/ue-v2-staging-deploy.yml', import.meta.url), 'utf8');
  const apply = workflow.split('\n  apply:\n')[1];
  assert(apply, 'Apply job must exist');
  const definitionCheckout = apply.split('      - name: Checkout workflow definition\n')[1]?.split('      - name: Checkout source_sha')[0];
  assert.match(definitionCheckout, /fetch-depth: 0/);
  assert.match(definitionCheckout, /persist-credentials: false/);
  const directory = mkdtempSync(join(tmpdir(), 'ue-ancestry-'));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const origin = join(directory, 'origin');
    git(directory, 'init', origin);
    git(origin, 'config', 'user.name', 'Synthetic ancestry fixture');
    git(origin, 'config', 'user.email', 'synthetic@example.invalid');
    writeFileSync(join(origin, 'source.txt'), 'serving');
    git(origin, 'add', 'source.txt'); git(origin, 'commit', '-m', 'serving source');
    const serving = git(origin, 'rev-parse', 'HEAD');
    writeFileSync(join(origin, 'source.txt'), 'candidate');
    git(origin, 'commit', '-am', 'candidate source');
    const candidate = git(origin, 'rev-parse', 'HEAD');
    writeFileSync(join(origin, 'source.txt'), 'admission');
    git(origin, 'commit', '-am', 'admitted workflow definition');
    const admitted = git(origin, 'rev-parse', 'HEAD');
    const url = pathToFileURL(origin).href;
    git(directory, 'clone', '--depth', '1', url, 'shallow');
    const refused = spawnSync('git', ['merge-base', '--is-ancestor', candidate, admitted], { cwd: join(directory, 'shallow'), encoding: 'utf8' });
    assert.notEqual(refused.status, 0, 'A shallow checkout must not fabricate ancestry');
    git(directory, 'clone', url, 'full');
    for (const source of [candidate, serving]) assert.equal(git(join(directory, 'full'), 'merge-base', '--is-ancestor', source, admitted), '');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
