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
