const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const tenant = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a';
const client = '5470c759-3dde-4009-9fd6-3eee46ab7b72';
test('a staging redeploy preserves the migrated Entra tenant and client instead of resurrecting the retired registration', () => {
  for (const name of ['main.staging.parameters.json','main.staging.bootstrap.parameters.json']) {
    const {parameters} = JSON.parse(fs.readFileSync(path.join(root,'infrastructure/bicep/ue-v2',name)));
    assert.equal(parameters.entraTenantId.value, tenant, name);
    assert.equal(parameters.entraClientId.value, client, name);
  }
  for (const name of ['qualify-ue-v2-real-entra.cjs','qualify-ue-v2-real-navigation.cjs']) {
    const source=fs.readFileSync(path.join(root,'tooling/scripts',name),'utf8');
    assert(source.includes(`const TENANT = '${tenant}'`), name);
  }
});


// A secret reference is unusable unless the staging identity also receives its
// named secret scope; do not grant vault-wide operator/password access.
test('every staging app secret reference has a scoped runtime grant and excludes operator credentials', () => {
  const main = fs.readFileSync(path.join(root, 'infrastructure/bicep/ue-v2/main.bicep'), 'utf8');
  const apps = fs.readFileSync(path.join(root, 'infrastructure/bicep/ue-v2/modules/apps.bicep'), 'utf8');
  const block = (text, name) => {
    const start = text.indexOf('var ' + name + ' = ');
    assert(start >= 0, name);
    const end = text.indexOf('\nvar ', start + 1);
    const resource = text.indexOf('\nresource ', start + 1);
    return text.slice(start, Math.min(...[end, resource, text.length].filter(x => x >= 0)));
  };
  const names = text => [...text.matchAll(/'([a-z][a-z0-9-]+)'/g)].map(match => match[1]);
  const grants = new Set(names(block(main, 'stagingRuntimeSecretNames')));
  const required = [...names(block(apps, 'secretNames')), ...names(block(apps, 'stagingAuthSystemSecretNames'))].filter(name => name !== 'staging');
  for (const name of required) assert(grants.has(name), 'Missing scoped runtime secret grant: ' + name);
  assert(grants.has('nar-signing-secret'));
  for (const name of ['admin-db-password', 'db-admin-password', 'bootstrap-database-url']) assert(!grants.has(name), name);
  assert.match(main, /scope: stagingRuntimeSecrets\[i\]/);
  assert.match(main, /resource kvSecretsUser[^\n]+if \(env == 'prod'\)/);
});

const vm = require('node:vm');
test('staging sealed exports use a dedicated named secret and preserve production configuration', () => {
  const source = fs.readFileSync(path.join(root, 'infrastructure/bicep/ue-v2/modules/apps.bicep'), 'utf8');
  const scopedNames = source.match(/var stagingAuthSystemSecretNames = deploymentEnvironment == 'staging' \? \[([^\]]+)\] : \[\]/);
  assert(scopedNames && scopedNames[1].includes("'evidence-seal-key'"));
  const staging = source.slice(source.indexOf('var stagingEnvironment = '), source.indexOf('var stripeSecretNames = '));
  assert(staging.startsWith("var stagingEnvironment = deploymentEnvironment == 'staging' ? ["));
  assert(staging.includes("{ name: 'EVIDENCE_SEAL_KEY', secretRef: 'evidence-seal-key' }"));
  assert(staging.trimEnd().endsWith('] : []'));
  assert.equal((source.match(/name: 'EVIDENCE_SEAL_KEY'/g) ?? []).length, 1);
  assert(!staging.includes("name: 'EVIDENCE_SEAL_KEY', secretRef: 'nar-signing-secret'"));
});
async function revokedSession({caseStatus = 401, documentStatus = 401, expired = false, wrongIdentity = false, wrongTenant = false} = {}) {
  const source = fs.readFileSync(path.join(root, 'tooling/scripts/qualify-ue-v2-real-entra.cjs'), 'utf8');
  const functionSource = source.slice(source.indexOf('async function verifyRevokedExistingSession('), source.indexOf('async function main()'));
  const calls = [], records = [];
  const ctx = vm.createContext({assert, Date, BASE: 'https://staging.invalid', TENANT: tenant, PEOPLE: {A: {oid: 'owned-officer'}},
    contexts: new Map([['A', {request: {get: async () => ({status: () => 200, json: async () => ({entraObjectId: wrongIdentity ? 'other' : 'owned-officer', tenantId: wrongTenant ? 'other' : tenant, expires: new Date(Date.now() + (expired ? -1000 : 60000)).toISOString()})})}}]]),
    request: async (key, route, method, data, expected) => {const status = route.includes('/documents/') ? documentStatus : caseStatus; calls.push({key, route}); assert(expected.includes(status)); return {status: () => status};},
    record: value => records.push(value)});
  await vm.runInContext(functionSource + '; verifyRevokedExistingSession("owned-case", "owned-document")', ctx);
  return {calls, records};
}
test('revocation requires an unexpired verified provider session and independent case and document denials', async () => {
  for (const status of [401, 403, 404]) {
    const {calls, records} = await revokedSession({caseStatus: status, documentStatus: status});
    assert.equal(calls.length, 2); assert(calls.every(x => x.key === 'A'));
    assert.equal(records[0].caseStatus, status); assert.equal(records[0].documentStatus, status);
  }
  for (const options of [{caseStatus: 200}, {documentStatus: 200}, {caseStatus: 500}, {documentStatus: 500}, {expired: true}, {wrongIdentity: true}, {wrongTenant: true}]) await assert.rejects(revokedSession(options));
});
