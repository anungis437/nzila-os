import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCTION_BOOTSTRAP_ORDER, currentSecurityInstallerExport, runCurrentSecurityBootstrapStage, runtimeGrantsFollowSecurityClosure } from './union-eyes-bootstrap-stages.mjs'

test('current source security is the atomic activation stage after the recorded security closures', () => {
  assert.equal(runtimeGrantsFollowSecurityClosure(), true)
  const activation = PRODUCTION_BOOTSTRAP_ORDER.find(stage => stage.id === 'runtime_grant_activation')
  assert.equal(activation.securityProfile, 'CURRENT_SOURCE_AUTH_FRAMEWORK_CASE')
  assert.equal(activation.atomic, true)
})

test('uses the caller connection and commits only after current source verification returns', async () => {
  const events = []
  const client = { query: async sql => { events.push(sql); return { rows: [] } } }
  const result = await runCurrentSecurityBootstrapStage(client, async actual => {
    assert.equal(actual, client)
    await actual.query('SOURCE_OWNED_METADATA_CHANGE')
    events.push('ALL_SOURCE_VALIDATION_RETURNED')
    return { fixture: 'verified component result' }
  }, {})
  assert.deepEqual(events, ['BEGIN', 'SOURCE_OWNED_METADATA_CHANGE', 'ALL_SOURCE_VALIDATION_RETURNED', 'COMMIT'])
  assert.equal(result.fixture, 'verified component result')
})

test('an admission failure rolls back the entire transition without a commit', async () => {
  const events = [], error = new Error('synthetic current catalog drift')
  const client = { query: async sql => { events.push(sql) } }
  await assert.rejects(runCurrentSecurityBootstrapStage(client, async actual => {
    await actual.query('SOURCE_OWNED_METADATA_CHANGE')
    throw error
  }, {}), failure => failure === error)
  assert.deepEqual(events, ['BEGIN', 'SOURCE_OWNED_METADATA_CHANGE', 'ROLLBACK'])
})

test('a failed commit is never reported as a successful activation', async () => {
  const events = [], error = new Error('synthetic commit failure')
  const client = { query: async sql => { events.push(sql); if (sql === 'COMMIT') throw error } }
  await assert.rejects(runCurrentSecurityBootstrapStage(client, async () => ({}), {}), failure => failure === error)
  assert.deepEqual(events, ['BEGIN', 'COMMIT', 'ROLLBACK'])
})

test('only unambiguous named or CommonJS installer function exports are accepted', () => {
  const install = () => undefined
  assert.equal(currentSecurityInstallerExport({ installUnionEyesCurrentSecurity: install }), install)
  assert.equal(currentSecurityInstallerExport({ default: { installUnionEyesCurrentSecurity: install } }), install)
  assert.equal(currentSecurityInstallerExport({ installUnionEyesCurrentSecurity: install, default: { installUnionEyesCurrentSecurity: install } }), install)
  assert.throws(() => currentSecurityInstallerExport({ default: install }), /export is missing/)
  assert.throws(() => currentSecurityInstallerExport({ installUnionEyesCurrentSecurity: false, default: { installUnionEyesCurrentSecurity: install } }), /not a function/)
  assert.throws(() => currentSecurityInstallerExport({ installUnionEyesCurrentSecurity: install, default: { installUnionEyesCurrentSecurity: () => undefined } }), /ambiguous/)
})

test('the real fresh-Node CLI loads the complete installer graph and restores loader configuration on success and failure', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import path from 'node:path';
    import { withCurrentSecurityInstaller } from './tooling/scripts/lib/union-eyes-bootstrap-stages.mjs';
    const original = 'synthetic-prior-tsconfig-value';
    process.env.TSX_TSCONFIG_PATH = original;
    const value = await withCurrentSecurityInstaller(process.cwd(), async install => {
      assert.equal(typeof install, 'function');
      assert.equal(process.env.TSX_TSCONFIG_PATH, path.join(process.cwd(),'apps/union-eyes/tsconfig.json'));
      return 'actual installer loaded without connecting a database';
    });
    assert.equal(value, 'actual installer loaded without connecting a database');
    assert.equal(process.env.TSX_TSCONFIG_PATH, original);
    const absent = mkdtempSync(path.join(tmpdir(),'ue-loader-import-failure-'));
    try {
      mkdirSync(path.join(absent,'apps/union-eyes'),{recursive:true});
      writeFileSync(path.join(absent,'apps/union-eyes/tsconfig.json'),JSON.stringify({compilerOptions:{}}));
      await assert.rejects(withCurrentSecurityInstaller(absent, async () => assert.fail('Missing source must not run')),
        error => error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');
      assert.equal(process.env.TSX_TSCONFIG_PATH, original);
    } finally { rmSync(absent,{recursive:true,force:true}); }
    let entered, release;
    const ready = new Promise(resolve => { entered = resolve; });
    const pending = withCurrentSecurityInstaller(process.cwd(), async install => {
      assert.equal(typeof install,'function');
      entered();
      await new Promise(resolve => { release = resolve; });
    });
    await ready;
    await assert.rejects(withCurrentSecurityInstaller(process.cwd(), async () => assert.fail('Concurrent source must not run')), /Concurrent current security loader is refused/);
    release();
    await pending;
    assert.equal(process.env.TSX_TSCONFIG_PATH, original);
    const failure = new Error('synthetic callback failure');
    await assert.rejects(withCurrentSecurityInstaller(process.cwd(), async install => {
      assert.equal(typeof install, 'function');
      throw failure;
    }), error => error === failure);
    assert.equal(process.env.TSX_TSCONFIG_PATH, original);
    delete process.env.TSX_TSCONFIG_PATH;
    await withCurrentSecurityInstaller(process.cwd(), async install => assert.equal(typeof install,'function'));
    assert.equal(Object.hasOwn(process.env,'TSX_TSCONFIG_PATH'), false);
  `], { cwd: repoRoot, encoding: 'utf8', timeout: 20_000 })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, result.stderr)
})
