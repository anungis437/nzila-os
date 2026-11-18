/** Actual postgres-js/Drizzle construction and context routing in fresh processes.
 * No network statements, driver mocks or authentication verdicts are involved;
 * native integration separately proves server identities, sessions and RLS. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../../..')
const app = path.join(root, 'apps/union-eyes')
const moduleUrl = pathToFileURL(path.join(app, 'db/db.ts')).href
const firstUrl = 'postgres://fixture_only:fixture_only@127.0.0.1:1/first_fixture'
const secondUrl = 'postgres://fixture_only:fixture_only@127.0.0.1:1/second_fixture'
const common = `
  import assert from 'node:assert/strict';
  import postgres from 'postgres';
  import {drizzle} from 'drizzle-orm/postgres-js';
  const load = raw => raw.db && raw.client ? raw : raw.default;
  const initial = process.env.DATABASE_URL;
  process.chdir(process.env.UE_LAZY_FIXTURE_CWD);
  const mod = load(await import(${JSON.stringify(moduleUrl)}));
  assert.ok(mod && mod.db && mod.client, 'actual database exports required');
`
function execute(body: string, options: { development?: boolean; configured?: boolean } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-db-lazy-'))
  writeFileSync(
    path.join(directory, '.env.local'),
    'DATABASE_URL=postgres://fixture_only:fixture_only@127.0.0.1:1/from_env_file\nDB_POOL_MAX=7\nDB_IDLE_TIMEOUT=11\nDB_CONNECTION_TIMEOUT=13\nDB_QUERY_TIMEOUT=17000\n',
  )
  try {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      NODE_ENV: options.development ? 'development' : 'production',
      NODE_OPTIONS: '--max-old-space-size=384',
      TSX_TSCONFIG_PATH: path.join(app, 'tsconfig.json'),
      UE_LAZY_FIXTURE_CWD: directory,
      ...(options.configured ? { DATABASE_URL: firstUrl } : {}),
    }
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', common + body],
      { cwd: root, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 },
    )
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('default database configuration is read only when its client is used', () => {
  it('can be imported before the actual URL is established', () =>
    execute(`
    assert.equal(initial, undefined);
    assert.equal(process.env.DATABASE_URL, undefined);
    process.env.DATABASE_URL=${JSON.stringify(firstUrl)};
    process.env.DB_POOL_MAX='9';process.env.DB_IDLE_TIMEOUT='19';
    process.env.DB_CONNECTION_TIMEOUT='23';process.env.DB_QUERY_TIMEOUT='29000';
    assert.equal(mod.client.options.database, 'first_fixture');
    assert.equal(mod.client.options.max,9);assert.equal(mod.client.options.idle_timeout,19);
    assert.equal(mod.client.options.connect_timeout,23);assert.equal(mod.client.options.connection.statement_timeout,29000);
    assert.equal(typeof mod.db.select, 'function');
    await mod.client.end({timeout:1});
  `))
  it('loads the real local-file fallback at first default use, never during import', () =>
    execute(
      `
    assert.equal(initial, undefined);
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(mod.client.options.database, 'from_env_file');
    assert.equal(mod.client.options.max,7);assert.equal(mod.client.options.idle_timeout,11);
    assert.equal(mod.client.options.connect_timeout,13);assert.equal(mod.client.options.connection.statement_timeout,17000);
    await mod.client.end({timeout:1});
  `,
      { development: true },
    ))
  it('routes real explicit tenant/system database objects without reading default configuration', () =>
    execute(
      `
    assert.equal(process.env.DATABASE_URL, undefined);
    const tenantRaw=await import(${JSON.stringify(pathToFileURL(path.join(app, 'db/tenant-context-storage.ts')).href)});
    const systemRaw=await import(${JSON.stringify(pathToFileURL(path.join(app, 'db/system-context-storage.ts')).href)});
    const tenant=tenantRaw.tenantContextStorage ?? tenantRaw.default.tenantContextStorage;
    const system=systemRaw.systemContextStorage ?? systemRaw.default.systemContextStorage;
    const tenantClient=postgres(${JSON.stringify(firstUrl)},{max:1,prepare:false});
    const systemClient=postgres(${JSON.stringify(secondUrl)},{max:1,prepare:false});
    const tenantDb=drizzle(tenantClient), systemDb=drizzle(systemClient);
    tenant.run(tenantDb,()=>{
      assert.equal(mod.db.query,tenantDb.query);
      system.run(systemDb,()=>assert.equal(mod.db.query,systemDb.query));
      assert.equal(mod.db.query,tenantDb.query);
    });
    system.run(systemDb,()=>assert.equal(mod.db.query,systemDb.query));
    assert.equal(process.env.DATABASE_URL,undefined);
    await tenantClient.end({timeout:1});await systemClient.end({timeout:1});
  `,
      { development: true },
    ))
  it('still refuses missing default configuration on actual use in production', () =>
    execute(`
    assert.equal(process.env.DATABASE_URL,undefined);
    assert.throws(()=>mod.client.options,{message:'Missing required environment variable: DATABASE_URL'});
    assert.equal(process.env.DATABASE_URL,undefined);
  `))
  it('keeps the initialized real default client pinned if later configuration changes', () =>
    execute(
      `
    const options=mod.client.options;
    assert.equal(options.database,'first_fixture');
    process.env.DATABASE_URL=${JSON.stringify(secondUrl)};
    assert.equal(mod.client.options,options);
    assert.equal(mod.client.options.database,'first_fixture');
    assert.equal(typeof mod.db.select,'function');
    await mod.client.end({timeout:1});
  `,
      { configured: true },
    ))
  it('a failed preconfiguration access does not cache an unusable client', () =>
    execute(`
    assert.throws(()=>mod.client.options,{message:'Missing required environment variable: DATABASE_URL'});
    process.env.DATABASE_URL=${JSON.stringify(firstUrl)};
    assert.equal(mod.client.options.database,'first_fixture');
    await mod.client.end({timeout:1});
  `))
})
