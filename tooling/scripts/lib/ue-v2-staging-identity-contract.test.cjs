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
