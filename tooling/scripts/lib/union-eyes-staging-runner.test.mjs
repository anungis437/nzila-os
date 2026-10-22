// Disposable local engine qualification. Never uses a supplied database URL.
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { signApproval } from './union-eyes-deployment-safety.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const BIN = process.env.UE_TEST_POSTGRES_BIN

test('shell proof runner against disposable PostgreSQL', { skip: !BIN, timeout: 240000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-staging-proof-'))
  const data = path.join(dir, 'pgdata')
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  const env = { ...process.env, PATH: `${BIN}${path.delimiter}${process.env.PATH}` }
  // Ignore any inherited live PostgreSQL credential/connection overrides.
  for (const key of Object.keys(env)) if (/^PG/.test(key)) delete env[key]
  const exe = (name) => path.join(BIN, name + (process.platform === 'win32' ? '.exe' : ''))
  function run(name, args, options = {}) {
    const result = spawnSync(exe(name), args, { encoding: 'utf8', env, timeout: 30000, ...options })
    const log = path.join(dir, 'postgres.log')
    const diagnostic = result.status === 0 ? '' : (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(-4000) : '')
    assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? '') + diagnostic)
    return result.stdout
  }
  const adminUrl = `host=127.0.0.1 port=${port} dbname=postgres user=postgres`
  const runtimeUrl = `host=127.0.0.1 port=${port} dbname=postgres user=union_eyes_runtime`
  const sql = (text) => run('psql', [adminUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: text })
  let started = false
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8', '--no-sync'], { timeout: 120000, stdio: 'ignore' })
    // Use TCP only. Distribution defaults can point Unix sockets at a shared
    // directory that the unprivileged CI runner cannot write.
    run('pg_ctl', ['-D', data, '-l', path.join(dir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c unix_socket_directories=`, '-w', 'start'], { stdio: 'ignore' })
    started = true
    const hash = 'd'.repeat(64)
    const manifest = { environment: 'staging', releaseSha: 'a'.repeat(40), frontendDigest: `sha256:${'b'.repeat(64)}`, backendDigest: `sha256:${'c'.repeat(64)}` }
    const fixture = {
      fixtureId: 'local-synthetic-only', environment: 'staging', synthetic: true, allowRolledBackWriteProbe: true,
      databaseName: 'postgres', databaseBaseline: 'local-disposable-baseline',
      tenantA: { organizationId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222', recordId: '33333333-3333-4333-8333-333333333333' },
      tenantB: { organizationId: '44444444-4444-4444-8444-444444444444', userId: '55555555-5555-4555-8555-555555555555', recordId: '66666666-6666-4666-8666-666666666666' },
    }
    const a = fixture.tenantA
    const b = fixture.tenantB
    const keys = crypto.generateKeyPairSync('ed25519')
    const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' })
    fs.writeFileSync(path.join(dir, 'trust.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }))
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest))
    const now = Date.now()
    const approval = {
      ...manifest, changeRecordId: 'LOCAL-TEST-ONLY', approvalStatus: 'APPROVED', approvedBy: ['local-test-owner'], approversRequired: ['local-test-owner'],
      issuedAt: new Date(now - 60000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
      databaseBaseline: fixture.databaseBaseline, recoveryMethod: 'point-in-time-restore', acceptanceFixture: fixture,
      restoredClone: {
        target: 'local-disposable-clone', sourceSha: manifest.releaseSha, frontendDigest: manifest.frontendDigest, backendDigest: manifest.backendDigest,
        databaseBaseline: fixture.databaseBaseline, changeRecordId: 'LOCAL-TEST-ONLY', recoveryPoint: new Date(now - 120000).toISOString(),
        tests: [{ name: 'local-test', ok: true }], schemaApply: { command: 'local-test-schema', exitCode: 0, target: 'restored-clone', provesApply: true },
      },
    }
    const writeApproval = () => fs.writeFileSync(path.join(dir, 'approval.json'), JSON.stringify(signApproval(approval, privateKey)))
    writeApproval()
    sql(`CREATE ROLE union_eyes_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE union_eyes_system LOGIN NOSUPERUSER NOBYPASSRLS;
CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(hash text);
INSERT INTO drizzle.__drizzle_migrations VALUES ('${hash}');
CREATE TABLE public.grievances(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
INSERT INTO public.grievances VALUES ('${a.recordId}','${a.organizationId}'), ('${b.recordId}','${b.organizationId}');
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievances FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.grievances TO union_eyes_runtime;`)
    const safe = `organization_id = NULLIF(current_setting('app.current_org_id',true),'')::uuid`
    const policy = (using = safe, check = safe) => sql(`DROP POLICY IF EXISTS tenant ON public.grievances;
CREATE POLICY tenant ON public.grievances TO union_eyes_runtime USING (${using}) WITH CHECK (${check});`)
    const output = path.join(dir, 'proof.json')
    const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
    function probe(overrides = {}) {
      return spawnSync(bash, ['tooling/scripts/union-eyes-read-staging-rls.sh', output, path.join(dir, 'manifest.json'), path.join(dir, 'approval.json'), path.join(dir, 'trust.pem'), 'true'], {
        cwd: ROOT, encoding: 'utf8', timeout: 30000,
        env: { ...env, RLS_MIGRATION_ADMIN_DATABASE_URL: adminUrl, RLS_VERIFY_DATABASE_URL: runtimeUrl, ...overrides },
      })
    }
    const refuse = (result) => { assert.notEqual(result.status, 0); assert.equal(fs.existsSync(output), false) }
    await t.test('positive fixture reads, bidirectional denial, empty context and forged inserts', () => {
      policy()
      const result = probe()
      assert.equal(result.status, 0, result.stdout + result.stderr)
      const proof = JSON.parse(fs.readFileSync(output, 'utf8')).databaseIsolation
      assert.equal(proof.identity.currentUser, 'union_eyes_runtime')
      assert.deepEqual(proof.counts, { fixtureA: 1, fixtureB: 1, ownA: 1, aReadsB: 0, ownB: 1, bReadsA: 0, emptyContext: 0 })
      assert.deepEqual(proof.forgedWrites, { aToB: '42501', bToA: '42501' })
      assert.equal(proof.candidateRevision, undefined)
    })
    await t.test('an empty table cannot pass and stale output is removed', () => {
      sql('TRUNCATE public.grievances;')
      refuse(probe())
      sql(`INSERT INTO public.grievances VALUES ('${a.recordId}','${a.organizationId}'), ('${b.recordId}','${b.organizationId}');`)
    })
    await t.test('all-hidden policy cannot fake isolation', () => { policy('false', safe); refuse(probe()) })
    await t.test('cross-tenant visible rows fail', () => { policy('true', safe); refuse(probe()) })
    await t.test('empty-context public policy fails', () => {
      policy(`(${safe}) OR COALESCE(current_setting('app.current_org_id',true),'') = ''`, safe)
      refuse(probe())
    })
    await t.test('forged write success fails without committing', () => {
      policy(safe, 'true')
      refuse(probe())
      assert.match(sql('SELECT count(*) FROM public.grievances;'), /\b2\b/)
    })
    await t.test('missing INSERT privilege is not mistaken for an RLS refusal', () => {
      policy()
      sql('REVOKE INSERT ON public.grievances FROM union_eyes_runtime;')
      refuse(probe())
      sql('GRANT INSERT ON public.grievances TO union_eyes_runtime;')
    })
    await t.test('actual privileged or wrong connection identity fails', () => {
      refuse(probe({ RLS_VERIFY_DATABASE_URL: adminUrl }))
      sql('ALTER ROLE union_eyes_runtime BYPASSRLS;')
      refuse(probe())
      sql('ALTER ROLE union_eyes_runtime NOBYPASSRLS;')
    })
    await t.test('unsigned fixture changes and unapproved environments fail before SQL', () => {
      const signed = signApproval(approval, privateKey)
      signed.acceptanceFixture = { ...fixture, fixtureId: 'tampered' }
      fs.writeFileSync(path.join(dir, 'approval.json'), JSON.stringify(signed))
      refuse(probe())
      writeApproval()
      approval.acceptanceFixture.environment = 'production'
      writeApproval()
      refuse(probe())
    })
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(dir).startsWith('ue-staging-proof-'))
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
})
