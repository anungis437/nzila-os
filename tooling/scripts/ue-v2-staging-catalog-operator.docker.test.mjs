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
import { CATALOG_SCHEMA, COUNT_MAX_STATEMENTS, PRIVILEGED_LOGIN, RUNTIME_LOGIN, RUNTIME_ROLE, containerSource, evaluateCatalogCompleteness, buildContinuationToken, generateRecipientKeyPair, openSealedCatalog, reconcileCatalogSessions, reconcilePlanes } from './ue-v2-staging-catalog-exec.mjs'
import { reassembleCatalog, sessionPlaneDefect, verifyImageSmoke } from './ue-v2-staging-catalog-job.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUN = '4242'
// The local proof shortens the statistics settle wait; the operator refuses that against Azure.
const SETTLE_MS = 1500
const SHA = 'a'.repeat(40)
const docker = (args, options = {}) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
const dockerReady = docker(['info', '--format', '{{.ServerVersion}}']).status === 0
// CI always has Docker; a skip there would hide the only end-to-end operator proof.
if (process.env.CI === 'true' && !dockerReady) throw new Error('Docker is required for the catalogue operator proof in CI')

test('both planes read staging-shaped PostgreSQL read-only: runtime posture, then sealed global totals that reconcile to one preimage', { skip: !dockerReady && 'Docker is not available' }, () => {
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
    // The image runs a temporary socket-only server during first-time initialisation and then
    // restarts. Probe over TCP, which only the final server listens on, and require a real query.
    let ready = false
    for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
      ready = docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'ue_v2_staging', '-Atc', 'SELECT 1']).stdout.trim() === '1'
      if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
    assert.equal(ready, true, 'PostgreSQL did not accept TCP connections')
    // 1,020 tables: 1,010 the runtime role may read, 10 it may not (as staging, where it lacks SELECT on 424).
    // More than the 1,000-statement ceiling, so the continuation path is still exercised on real PostgreSQL.
    const tables = Array.from({ length: 1020 }, (_, index) => `t${String(index).padStart(4, '0')}`)
    const hidden = new Set(tables.slice(1010))
    const adminPassword = String.fromCharCode(97, 100, 109, 105, 110, 116, 101, 115, 116)
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
        ...(hidden.has(table) ? [] : [`GRANT SELECT ON public.${table} TO ${RUNTIME_ROLE}`]),
      ]),
      // Staging's privileged shape: not a superuser; BYPASSRLS; pg_read_all_data through an admin group.
      'CREATE ROLE azure_pg_admin NOLOGIN',
      'GRANT pg_read_all_data TO azure_pg_admin',
      `CREATE ROLE ${PRIVILEGED_LOGIN} LOGIN NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${adminPassword}'`,
      `GRANT azure_pg_admin TO ${PRIVILEGED_LOGIN}`,
      // A migration ledger and an audit table the runtime role cannot reach at all.
      'CREATE SCHEMA drizzle',
      'CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)',
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('h-0001', 1767225600000), ('h-0002', 1767312000000)",
      'CREATE SCHEMA audit_security',
      'CREATE TABLE audit_security.audit_logs (id bigint, action text)',
      'ALTER TABLE audit_security.audit_logs ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE audit_security.audit_logs FORCE ROW LEVEL SECURITY',
      "INSERT INTO audit_security.audit_logs VALUES (1, 'a'), (2, 'b')",
    ].join(';\n')
    const applied = docker(['exec', '-i', '-e', `PGPASSWORD=${password}`, name, 'psql', '-q', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'ue_v2_staging', '-v', 'ON_ERROR_STOP=1'], { input: `${setup};\n` })
    assert.equal(applied.status, 0, applied.stderr)
    const before = docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-At', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'ue_v2_staging', '-c',
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
      const result = docker(['run', '--rm', '--user', '1001:1001', '--network', network, '-e', 'NODE_PATH=', '-e', 'UE_CATALOG_TRANSPORT=private-job',
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
    assert.equal(runtime.identity.default_read_only, 'on')
    assert.equal(runtime.rolledBack, true)
    // Staging's database-url carries its own options= (run 46019964268). With the real pg
    // driver, the session must still start read-only by default and act as the runtime role.
    const staged = operate(`${url(RUNTIME_LOGIN, loginPassword)}?options=${encodeURIComponent(`-c role=${RUNTIME_ROLE}`)}`).body
    assert.equal(staged.blocker, undefined)
    assert.equal(staged.identity.default_read_only, 'on')
    assert.equal(staged.identity.user, RUNTIME_ROLE)
    assert.equal(staged.identity.session_user, RUNTIME_LOGIN)
    assert.equal(runtime.privilege.classification, 'LIMITED_RUNTIME')
    assert.equal(runtime.runtime.uid, 1001)
    assert.match(runtime.runtime.pgPath, /^\/app\/node_modules\/pg\//)
    assert.equal(stdout.includes(loginPassword), false)
    const observed = runtime.counts.filter((item) => item.classification === 'OBSERVED')
    const deferred = runtime.counts.filter((item) => item.classification === 'NOT_ATTEMPTED')
    const denied = runtime.counts.filter((item) => item.classification === 'PRIVILEGE_DENIED')
    assert.equal(observed.length, COUNT_MAX_STATEMENTS, 'the 1,000-statement ceiling is honoured')
    assert.equal(deferred.length, 10)
    assert.deepEqual(denied.map((item) => `${item.schema}.${item.name}`), ['audit_security.audit_logs', 'drizzle.__drizzle_migrations', ...[...hidden].map((table) => `public.${table}`)], 'tables without SELECT or schema USAGE are classified from the catalogue, not counted')
    assert.ok(observed.every((item) => item.n === '0' && item.countScope === 'ROLE_VISIBLE' && item.globalTotal === false), 'RLS stays in force: role-visible counts are zero and not totals')
    assert.equal(runtime.counts.some((item) => item.classification === 'UNREADABLE'), false, 'no statement is spent on a table the role cannot read')
    const queryOf = (catalog, id) => catalog.queries.find((item) => item.id === id)
    assert.equal(queryOf(runtime, 'migration_columns').rows.filter((row) => row.table_name === '__drizzle_migrations').length, 3, 'pg_attribute shows the ledger columns information_schema hid')
    assert.equal(queryOf(runtime, 'drizzle_rows').classification, 'PRIVILEGE_DENIED')
    assert.equal(queryOf(runtime, 'audit').rows.length, 1, 'the audit table is seen in pg_class without schema USAGE')
    assert.equal(queryOf(runtime, 'audit').rows[0].schema_usage, false)
    assert.equal(queryOf(runtime, 'privilege_matrix').rows.length, 1022)
    const evaluation = evaluateCatalogCompleteness(runtime)
    assert.equal(evaluation.verdict, 'CATALOG_PARTIAL')
    assert.equal(evaluation.planeVerdict, 'PLANE_ACCEPTED')
    assert.equal(evaluation.categories.find((category) => category.id === 'preservation_counts').classification, 'NOT_IN_PLANE')
    const binding = { revision: 'r', image: 'i', source: SHA }
    const token = buildContinuationToken(runtime, { ...binding, sessionId: 's' })
    assert.equal(token.remaining.length, 10)

    // A continuation session counts only the remaining tables.
    const { body: continued } = operate(url(RUNTIME_LOGIN, loginPassword), ['-e', `UE_CATALOG_CONTINUATION=${JSON.stringify(token)}`])
    assert.equal(continued.sessionKind, 'continuation')
    assert.equal(continued.counts.length, 10)
    assert.ok(continued.counts.every((item) => item.classification === 'OBSERVED'))
    const runtimeChain = reconcileCatalogSessions([{ catalog: runtime, observedAt: runtime.observedAt }, { catalog: continued, token, observedAt: continued.observedAt }], binding)
    assert.equal(runtimeChain.evaluation.planeVerdict, 'PLANE_ACCEPTED', runtimeChain.reason)

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

    // ── Plane B: the admin login, REPEATABLE READ READ ONLY, values sealed to the founder.
    const founder = generateRecipientKeyPair()
    const privilegedEnv = (user = PRIVILEGED_LOGIN, secret = adminPassword, recipient = founder.publicKey) => ['-e', 'UE_CATALOG_PLANE=privileged', '-e', `PGHOST=${name}`, '-e', `PGUSER=${user}`,
      '-e', `PGPASSWORD=${secret}`, '-e', 'PGDATABASE=ue_v2_staging', '-e', 'UE_CATALOG_PG_TLS=disable-for-local-proof', '-e', `UE_CATALOG_STATS_SETTLE_MS=${SETTLE_MS}`, ...(recipient ? ['-e', `UE_CATALOG_EVIDENCE_RECIPIENT=${recipient}`] : [])]
    const { body: keyless } = operate(null, privilegedEnv(PRIVILEGED_LOGIN, adminPassword, null))
    assert.equal(keyless.blocker, 'EVIDENCE_RECIPIENT_MISSING', 'no sealing key, no connection')
    assert.equal(keyless.identity, undefined)
    const { body: superuser } = operate(null, privilegedEnv('postgres', password))
    assert.equal(superuser.blocker, 'PRIVILEGED_CREDENTIAL_ABSENT', 'only the expected admin login is a privileged session')

    // The database itself refuses writes from the admin login in the operator's transaction
    // shape and with the operator's session default, though the login can write otherwise.
    const asAdmin = (sql, options = '') => docker(['exec', '-e', `PGPASSWORD=${adminPassword}`, '-e', `PGOPTIONS=${options}`, name, 'psql', '-h', '127.0.0.1', '-U', PRIVILEGED_LOGIN, '-d', 'ue_v2_staging', '-v', 'ON_ERROR_STOP=1', '-Atc', sql])
    const inTransaction = asAdmin("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; INSERT INTO public.t0000 VALUES (99, 'x'); COMMIT")
    assert.notEqual(inTransaction.status, 0)
    assert.match(inTransaction.stderr, /cannot execute INSERT in a read-only transaction/)
    const sessionDefault = asAdmin("INSERT INTO public.t0000 VALUES (99, 'x')", '-c default_transaction_read_only=on')
    assert.notEqual(sessionDefault.status, 0)
    assert.match(sessionDefault.stderr, /read-only transaction/)

    const { body: sealedBaseline, stdout: privilegedStdout } = operate(null, privilegedEnv())
    assert.equal(sealedBaseline.blocker, undefined, sealedBaseline.error)
    assert.equal(sealedBaseline.identity.user, PRIVILEGED_LOGIN)
    assert.equal(sealedBaseline.identity.isolation, 'repeatable read')
    assert.equal(sealedBaseline.identity.transaction_read_only, 'on')
    assert.equal(sealedBaseline.rolledBack, true)
    assert.equal(sealedBaseline.privilege.rolsuper, false)
    assert.equal(sealedBaseline.privilege.rolbypassrls, true)
    assert.equal(sealedBaseline.identity.default_read_only, 'on')
    assert.ok(queryOf(sealedBaseline, 'privilege_matrix').rows.every((row) => row.rls_active === false), 'PostgreSQL reports row security inactive for this session on every table')
    assert.ok(sealedBaseline.statsSettledMs >= SETTLE_MS)
    assert.equal(sealedBaseline.settledModificationDigest, sealedBaseline.modificationDigest)
    assert.ok(queryOf(sealedBaseline, 'effective_roles').rows.some((row) => row.rolname === 'pg_read_all_data'), 'actual inherited privileges are recorded')
    assert.equal(sessionPlaneDefect(sealedBaseline, 'privileged', founder.keyId), null)
    assert.equal(privilegedStdout.includes(adminPassword), false)
    assert.equal(privilegedStdout.includes('h-0001'), false, 'the ledger never leaves the container in the clear')
    assert.ok(sealedBaseline.counts.filter((item) => item.classification === 'OBSERVED').every((item) => item.n === null && item.sealed === true && item.countScope === 'GLOBAL'))
    assert.equal(evaluateCatalogCompleteness(sealedBaseline).categories.find((category) => category.id === 'preservation_counts').accepted, false, 'sealed is not accepted')

    const baseline = openSealedCatalog(sealedBaseline, founder.privateKeyPem)
    assert.equal(baseline.run, RUN)
    assert.equal(baseline.source, SHA)
    const globals = baseline.catalog.counts.filter((item) => item.classification === 'OBSERVED')
    assert.equal(globals.length, COUNT_MAX_STATEMENTS)
    assert.ok(globals.every((item) => item.n === (item.schema === 'public' ? '3' : '2')), 'exact global totals: 3 rows per business table where the runtime role saw 0, 2 in the ledger and the forced-RLS audit table')
    assert.equal(baseline.catalog.counts.filter((item) => item.classification === 'NOT_ATTEMPTED').length, 22, 'bounded: the 15s/45s/1000 ceiling')
    assert.deepEqual(queryOf(baseline.catalog, 'drizzle_rows').rows.map((row) => row.hash), ['h-0001', 'h-0002'])

    const privilegedToken = buildContinuationToken(sealedBaseline, { ...binding, sessionId: 'b1' })
    assert.equal(privilegedToken.plane, 'privileged')
    const { body: sealedContinued } = operate(null, [...privilegedEnv(), '-e', `UE_CATALOG_CONTINUATION=${JSON.stringify(privilegedToken)}`])
    assert.equal(sealedContinued.sessionKind, 'continuation')
    const continuedOpen = openSealedCatalog(sealedContinued, founder.privateKeyPem).catalog
    assert.equal(continuedOpen.counts.length, 22)
    assert.ok(continuedOpen.counts.every((item) => item.classification === 'OBSERVED' && item.n !== null))
    const privilegedChain = reconcileCatalogSessions([{ catalog: baseline.catalog, observedAt: baseline.catalog.observedAt }, { catalog: continuedOpen, token: privilegedToken, observedAt: continuedOpen.observedAt }], binding, { statsSettleMs: SETTLE_MS })
    assert.equal(privilegedChain.evaluation?.planeVerdict, 'PLANE_ACCEPTED', privilegedChain.reason)
    assert.equal(privilegedChain.consistency.atomicSnapshot, false)
    assert.equal(privilegedChain.consistency.basis, 'MULTI_SESSION_NO_CHANGE_DETECTED')

    const preimage = reconcilePlanes({ runtime: runtimeChain, privileged: privilegedChain })
    assert.equal(preimage.verdict, 'CATALOG_COMPLETE', JSON.stringify(preimage.categories.filter((category) => !category.accepted).map((category) => category.id)))
    assert.equal(preimage.consistency.crossPlaneAtomic, false)

    // Nothing was written: relations, ACLs and row-change counters are unchanged.
    const after = docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-At', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'ue_v2_staging', '-c',
      "SELECT md5(string_agg(c.relname||':'||c.relkind||':'||coalesce(c.relacl::text,''), ',' ORDER BY c.relname)) || ':' || (SELECT sum(n_tup_ins+n_tup_upd+n_tup_del) FROM pg_stat_user_tables) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"]).stdout.trim()
    assert.equal(after, before)

    // A change between privileged sessions is detected and the chain is refused.
    assert.equal(docker(['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'ue_v2_staging', '-c', "INSERT INTO public.t0000 VALUES (4, 'org-a')"]).status, 0)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500)
    const { body: sealedDrifted } = operate(null, [...privilegedEnv(), '-e', `UE_CATALOG_CONTINUATION=${JSON.stringify(privilegedToken)}`])
    const drifted = openSealedCatalog(sealedDrifted, founder.privateKeyPem).catalog
    const refused = reconcileCatalogSessions([{ catalog: baseline.catalog, observedAt: baseline.catalog.observedAt }, { catalog: drifted, token: privilegedToken, observedAt: drifted.observedAt }], binding, { statsSettleMs: SETTLE_MS })
    assert.equal(refused.reason, 'DATA_DRIFT_BETWEEN_SESSIONS')
  } finally {
    rmSync(context, { recursive: true, force: true })
    docker(['rm', '-f', name])
    docker(['network', 'rm', network])
  }
})
