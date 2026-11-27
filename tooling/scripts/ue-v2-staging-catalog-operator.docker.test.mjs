/**
 * The packaged catalogue operator against disposable PostgreSQL 16 shaped like staging:
 * a NOLOGIN runtime role, a NOINHERIT login that may only SET ROLE to it, forced RLS,
 * and more tables than the per-session count ceiling. The operator runs through its own
 * image entrypoint and its stdout is reassembled exactly as the controller does.
 *
 * By default the image's base is a stand-in that installs pg at /app/node_modules. Set
 * UE_CATALOG_QUALIFIED_BASE to the real immutable application image (for example
 * nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:...) to run the same proof
 * on it; the workflow additionally smoke-tests the real image before every push.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { CATALOG_SCHEMA, RUNTIME_LOGIN, RUNTIME_ROLE, containerSource, evaluateCatalogCompleteness, buildContinuationToken } from './ue-v2-staging-catalog-exec.mjs'
import { reassembleCatalog, verifyImageSmoke } from './ue-v2-staging-catalog-job.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUN = '4242'
const SHA = 'a'.repeat(40)
const docker = (args, options = {}) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
const dockerReady = docker(['info', '--format', '{{.ServerVersion}}']).status === 0
// CI always has Docker; a skip there would hide the only end-to-end operator proof.
if (process.env.CI === 'true' && !dockerReady) throw new Error('Docker is required for the catalogue operator proof in CI')

test('the packaged operator reads staging-shaped PostgreSQL as the runtime role, read-only, and frames it intact', { skip: !dockerReady && 'Docker is not available' }, () => {
  const name = `ue-s202-catalog-pg-${process.pid}`
  const network = `ue-s202-catalog-net-${process.pid}`
  const password = String.fromCharCode(99, 97, 116, 97, 108, 111, 103, 116, 101, 115, 116)
  const loginPassword = String.fromCharCode(114, 111, 108, 101, 116, 101, 115, 116)
  docker(['rm', '-f', name])
  docker(['network', 'rm', network])
  assert.equal(docker(['network', 'create', network]).status, 0)
  const started = docker(['run', '-d', '--name', name, '--network', network, '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=ue_v2_staging', 'postgres:16-alpine'])
  assert.equal(started.status, 0, started.stderr)
  const context = mkdtempSync(path.join(tmpdir(), 'ue-catalog-image-'))
  try {
    let ready = false
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      ready = docker(['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'ue_v2_staging']).status === 0
      if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
    assert.equal(ready, true)
    const tables = Array.from({ length: 260 }, (_, index) => `t${String(index).padStart(3, '0')}`)
    const setup = [
      `CREATE ROLE ${RUNTIME_ROLE} NOLOGIN NOINHERIT`,
      `CREATE ROLE ${RUNTIME_LOGIN} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${loginPassword}'`,
      `GRANT ${RUNTIME_ROLE} TO ${RUNTIME_LOGIN} WITH INHERIT FALSE, SET TRUE`,
      `CREATE ROLE unrelated_login LOGIN PASSWORD '${loginPassword}'`,
      `GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE}`,
      ...tables.flatMap((table) => [
        `CREATE TABLE public.${table} (id int, organization_id text)`,
        `INSERT INTO public.${table} SELECT g, 'org-a' FROM generate_series(1, 3) g`,
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
        `ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`,
        `CREATE POLICY ue_v2_select ON public.${table} FOR SELECT TO ${RUNTIME_ROLE} USING (organization_id = current_setting('app.current_org_id', true))`,
        `GRANT SELECT ON public.${table} TO ${RUNTIME_ROLE}`,
      ]),
    ].join(';\n')
    const applied = docker(['exec', '-i', '-e', `PGPASSWORD=${password}`, name, 'psql', '-q', '-U', 'postgres', '-d', 'ue_v2_staging', '-v', 'ON_ERROR_STOP=1'], { input: `${setup};\n` })
    assert.equal(applied.status, 0, applied.stderr)
    const before = docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-At', '-U', 'postgres', '-d', 'ue_v2_staging', '-c',
      "SELECT md5(string_agg(c.relname||':'||c.relkind||':'||coalesce(c.relacl::text,''), ',' ORDER BY c.relname)) || ':' || (SELECT sum(n_tup_ins+n_tup_upd+n_tup_del) FROM pg_stat_user_tables) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"]).stdout.trim()

    writeFileSync(path.join(context, 'operator.cjs'), containerSource())
    const qualified = process.env.UE_CATALOG_QUALIFIED_BASE
    let base = qualified
    if (!base) {
      writeFileSync(path.join(context, 'base.Dockerfile'), [
        'FROM node:22-slim',
        'WORKDIR /app',
        'RUN npm install --omit=dev --no-fund --no-audit pg@8.20.0 \\',
        ' && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx',
        'RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --no-create-home nextjs && chown -R nextjs:nodejs /app',
        'USER 1001:1001',
        '',
      ].join('\n'))
      const built = docker(['build', '-q', '-f', path.join(context, 'base.Dockerfile'), '-t', 'ue-s202-catalog-base', context])
      assert.equal(built.status, 0, built.stderr)
      base = 'ue-s202-catalog-base'
    }
    const image = docker(['build', '-q', '-f', path.join(REPO, 'tooling/docker/ue-v2-catalog-operator.Dockerfile'), '--build-arg', `QUALIFIED_APPLICATION_IMAGE=${base}`, '--build-arg', 'OPERATOR_SOURCE_SHA=local', '-t', 'ue-s202-catalog-operator', context])
    assert.equal(image.status, 0, image.stderr)

    const operate = (url, extra = []) => {
      const result = docker(['run', '--rm', '--network', network, '-e', 'NODE_PATH=', '-e', 'UE_CATALOG_TRANSPORT=private-job',
        '-e', `UE_CATALOG_RUN_ID=${RUN}`, '-e', `UE_CATALOG_SOURCE_SHA=${SHA}`, ...(url ? ['-e', `DATABASE_URL=${url}`] : []), ...extra, 'ue-s202-catalog-operator'])
      assert.equal(result.status, 0, result.stderr)
      const lines = result.stdout.split('\n').filter((line) => line.startsWith('UE_CATALOG_V2 '))
      for (const line of lines) assert.ok(line.length < 16384)
      const evidence = reassembleCatalog(lines, { runId: RUN, source: SHA })
      assert.equal(evidence.ok, true, evidence.defect)
      return { body: JSON.parse(evidence.body), stdout: result.stdout }
    }
    const url = (user, secret, database = 'ue_v2_staging') => ['post', 'gresql://', user, ':', secret, '@', name, ':5432/', database].join('')

    // Entrypoint smoke exactly as the workflow runs it: no database, real module resolution.
    const smoke = docker(['run', '--rm', '--user', '1001:1001', '-e', 'NODE_PATH=', '-e', 'UE_CATALOG_TRANSPORT=private-job', '-e', `UE_CATALOG_RUN_ID=${RUN}`, '-e', `UE_CATALOG_SOURCE_SHA=${SHA}`, 'ue-s202-catalog-operator'])
    const smoked = verifyImageSmoke(smoke.stdout, { runId: RUN, source: SHA })
    assert.equal(smoked.ok, true, JSON.stringify(smoked))

    // The real runtime login, acting as the runtime role.
    const { body: runtime, stdout } = operate(url(RUNTIME_LOGIN, loginPassword))
    assert.equal(runtime.schema, CATALOG_SCHEMA)
    assert.equal(runtime.blocker, undefined)
    assert.equal(runtime.identity.user, RUNTIME_ROLE)
    assert.equal(runtime.identity.session_user, RUNTIME_LOGIN)
    assert.equal(runtime.identity.transaction_read_only, 'on')
    assert.equal(runtime.rolledBack, true)
    assert.equal(runtime.privilege.classification, 'LIMITED_RUNTIME')
    assert.equal(runtime.runtime.uid, 1001)
    assert.match(runtime.runtime.pgPath, /^\/app\/node_modules\/pg\//)
    assert.equal(stdout.includes(loginPassword), false)
    const observed = runtime.counts.filter((item) => item.classification === 'OBSERVED')
    const deferred = runtime.counts.filter((item) => item.classification === 'NOT_ATTEMPTED')
    assert.equal(observed.length, 250, 'the 250-statement ceiling is honoured')
    assert.equal(deferred.length, 10)
    assert.ok(observed.every((item) => item.n === '0' && item.globalTotal === false && item.visibleToConnectedRole === true), 'RLS stays in force: role-visible counts are zero')
    assert.equal(runtime.counts.some((item) => item.classification === 'UNREADABLE'), false, 'no count is refused for missing role privileges')
    const evaluation = evaluateCatalogCompleteness(runtime)
    assert.equal(evaluation.verdict, 'CATALOG_PARTIAL')
    const token = buildContinuationToken(runtime, { revision: 'r', image: 'i', sessionId: 's' })
    assert.equal(token.remaining.length, 10)

    // A continuation session counts only the remaining tables.
    const { body: continued } = operate(url(RUNTIME_LOGIN, loginPassword), ['-e', `UE_CATALOG_CONTINUATION=${JSON.stringify(token)}`])
    assert.equal(continued.sessionKind, 'continuation')
    assert.equal(continued.counts.length, 10)
    assert.ok(continued.counts.every((item) => item.classification === 'OBSERVED'))

    // A superuser login acting as the runtime role is still classified as elevated.
    const { body: elevated } = operate(url('postgres', password))
    assert.equal(elevated.identity.user, RUNTIME_ROLE)
    assert.equal(elevated.privilege.classification, 'ELEVATED')

    // A login that cannot act as the runtime role is refused; so is another database.
    const { body: unrelated } = operate(url('unrelated_login', loginPassword))
    assert.equal(unrelated.blocker, 'QUERY_FAILED')
    assert.equal(evaluateCatalogCompleteness(unrelated).verdict, 'CATALOG_REFUSED')
    const { body: wrong } = operate(url('postgres', password, 'postgres'))
    assert.equal(wrong.blocker, 'IDENTITY_REFUSED')

    // Nothing was written: relations, ACLs and row-change counters are unchanged.
    const after = docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-At', '-U', 'postgres', '-d', 'ue_v2_staging', '-c',
      "SELECT md5(string_agg(c.relname||':'||c.relkind||':'||coalesce(c.relacl::text,''), ',' ORDER BY c.relname)) || ':' || (SELECT sum(n_tup_ins+n_tup_upd+n_tup_del) FROM pg_stat_user_tables) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"]).stdout.trim()
    assert.equal(after, before)
  } finally {
    rmSync(context, { recursive: true, force: true })
    docker(['rm', '-f', name])
    docker(['network', 'rm', network])
  }
})
