import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BASELINE_LEDGER_DIGEST, BINDINGS, TARGET_HOST, TARGET_DATABASE, historicalJournal,
  assertPublicPolicyNonRegression, lineageJournals, planClone, readBaseline, reconcileClone, recoveryContext, sha256, validateBaselineRows, validateRecoveryContext, validateTarget,
} from './ue-staging-historical-lineage.mjs'
import { assertJournalPrefix, assertMigrationLedgerIntegrity, ledgerDigest } from './union-eyes-migration-ledger.mjs'
import { applyScopedMigrations, scopedLedgerJournal } from './union-eyes-scoped-migrations.mjs'
import { runCheck } from '../apply-union-eyes-scoped-migrations-existing-env.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const snapshotPath = process.env.UE_LINEAGE_TEST_SNAPSHOT
function fixtureUrl(host = TARGET_HOST, database = TARGET_DATABASE, port = '') {
  const url = new URL(`postgres://${host}/${database}`)
  url.username = 'u'
  url.password = 'p'
  url.port = port
  return url.toString()
}
const options = () => {
  const migrationsDir = path.join(root, 'apps/union-eyes/db/migrations-cache')
  return { snapshot: readBaseline(snapshotPath), migrationsDir, journalPath: path.join(migrationsDir, 'meta/_journal.json') }
}

test('target guard rejects production, source server, alternate database and port', () => {
  for (const target of [
    fixtureUrl('nzila-production-db.postgres.database.azure.com'),
    fixtureUrl('nzila-staging-db.postgres.database.azure.com'),
    fixtureUrl(TARGET_HOST, 'postgres'), fixtureUrl(TARGET_HOST, TARGET_DATABASE, '5444'),
  ]) assert.throws(() => validateTarget(target), /exact authorized staging clone/)
})

test('target config forces explicit clone routing and hostname-verified TLS before connect', async () => {
  const config = validateTarget(fixtureUrl())
  assert.deepEqual(config.ssl, { rejectUnauthorized: true, servername: TARGET_HOST })
  assert.equal('connectionString' in config, false)
  const { default: pg } = await import('pg')
  const client = new pg.Client(config)
  assert.equal(client.connectionParameters.host, TARGET_HOST)
  assert.equal(client.connectionParameters.port, 5432)
  assert.equal(client.connectionParameters.database, TARGET_DATABASE)
  assert.equal(client.connectionParameters.user, 'u')
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true)
  assert.equal(client.connectionParameters.ssl.servername, TARGET_HOST)
})

test('URL routing and SSL overrides are rejected before client construction', () => {
  for (const query of ['host=production', 'port=5444', 'hostaddr=127.0.0.1', 'service=production',
    'options=-c%20search_path%3Devil', 'sslmode=disable', 'sslrejectunauthorized=false', 'sslcert=somefile',
    'host=production&port=5444', 'application_name=unreviewed']) {
    assert.throws(() => validateTarget(`${fixtureUrl()}?${query}`), /query options and fragments are forbidden/)
  }
})

test('snapshot digest rejects modified evidence before database use', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-lineage-'))
  try {
    const file = path.join(directory, 'altered.json')
    fs.writeFileSync(file, '{"ledger":[]}')
    assert.throws(() => readBaseline(file), /snapshot digest mismatch/)
  } finally { fs.rmSync(directory, { recursive: true }) }
})

test('historical mappings bind exactly three journal positions without modifying inputs', () => {
  const journal = { name: 'scoped', entries: BINDINGS.map((binding) => ({ tag: binding.tag, hash: binding.current })) }
  const mapped = historicalJournal(journal)
  assert.deepEqual(mapped.entries.map((entry) => entry.hash), BINDINGS.map((binding) => binding.historical))
  assert.equal(journal.entries[0].hash, BINDINGS[0].current)
  assert.equal(sha256('evidence').length, 64)
})

test('baseline rejects changed, unknown, duplicate and mixed lineage', { skip: !snapshotPath }, () => {
  const snapshot = readBaseline(snapshotPath)
  assert.equal(ledgerDigest(snapshot.ledger), BASELINE_LEDGER_DIGEST)
  for (const mutate of [
    (rows) => { rows[0].hash = '0'.repeat(64) },
    (rows) => { rows[1].hash = rows[0].hash },
    (rows) => { rows[10].hash = BINDINGS[0].current },
    (rows) => { rows[0].id = 100 },
  ]) {
    const rows = structuredClone(snapshot.ledger); mutate(rows)
    assert.throws(() => validateBaselineRows(rows), /baseline ledger mismatch|lineage/)
  }
})

test('caller-created snapshot cannot bypass byte-level source evidence', async () => {
  await assert.rejects(reconcileClone({}, { snapshot: { ledger: [] } }), /exact reviewed snapshot bytes/)
})

test('caller cannot fabricate an effective applied-hash context', async () => {
  await assert.rejects(validateRecoveryContext({}, { appliedHashes: new Set(BINDINGS.map((binding) => binding.current)) }), /Unverified staging/)
})

test('historical replay permits exact legacy PUBLIC subset but forbids new or changed policies', () => {
  const legacy = { schemaname: 'public', tablename: 'deadline_reminders', policyname: 'legacy', roles: '{public}', cmd: 'ALL', qual: 'known legacy predicate', with_check: null, permissive: 'PERMISSIVE' }
  assert.doesNotThrow(() => assertPublicPolicyNonRegression([legacy], [legacy]))
  assert.doesNotThrow(() => assertPublicPolicyNonRegression([], [legacy]))
  assert.throws(() => assertPublicPolicyNonRegression([{ ...legacy, qual: 'true' }], [legacy]), /introduced or altered/)
  assert.throws(() => assertPublicPolicyNonRegression([{ ...legacy, tablename: 'new_table' }], [legacy]), /introduced or altered/)
})

function fakeClient(snapshot) {
  const state = { rows: structuredClone(snapshot.ledger), receipt: null, anchors: [], writes: [] }
  const client = {
    connectionParameters: { host: TARGET_HOST, database: TARGET_DATABASE }, state,
    async query(sql, values) {
      if (sql.startsWith('SELECT current_database()')) return { rows: [{ database: TARGET_DATABASE, ssl: true }] }
      if (sql.startsWith('SELECT to_regclass')) return { rows: [{ regclass: sql.includes('bootstrap_attestations') ? (state.anchors.length ? 'drizzle.bootstrap_attestations' : null) : 'drizzle.__drizzle_migrations' }] }
      if (sql.includes("payload->'migrationLedger'")) return { rows: state.anchors.map((anchor, index) => ({ id: index + 1, ledger: anchor })) }
      if (sql.startsWith('SELECT id, hash')) return { rows: structuredClone(state.rows) }
      if (sql.startsWith('SELECT hash')) return { rows: state.rows.map(({ hash }) => ({ hash })) }
      if (sql.startsWith('SELECT payload')) return { rows: state.receipt ? [{ payload: state.receipt }] : [] }
      if (sql.startsWith('SELECT c.relname')) return { rows: [{ relname: 'organizations', relrowsecurity: true, relforcerowsecurity: true }] }
      if (sql.startsWith('SELECT rolname')) return { rows: ['union_eyes_runtime', 'union_eyes_system'].map((rolname) => ({ rolname, rolsuper: false, rolbypassrls: false })) }
      if (sql.startsWith('SELECT schemaname, tablename')) return { rows: [] }
      state.writes.push(sql)
      if (sql.startsWith('INSERT INTO drizzle.ue_staging_lineage_recovery')) {
        // jsonb does not preserve object-key insertion order.
        state.receipt = JSON.parse(values[0], (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).reverse()) : value)
      }
      if (sql.startsWith('INSERT INTO drizzle.__drizzle_migrations')) state.rows.push({ id: state.rows.length + 1, hash: values[0], created_at: String(values[1]) })
      return { rows: [] }
    },
  }
  return client
}

test('read-only plan and explicit executor context preserve truthful historical rows', { skip: !snapshotPath }, async () => {
  const opts = options()
  const client = fakeClient(opts.snapshot)
  const plan = await planClone(client, opts)
  assert.equal(plan.mutation, false)
  assert.equal(client.state.writes.length, 0)
  await assert.rejects(assertJournalPrefix(client, scopedLedgerJournal(opts)), /integrity failure/)
  await reconcileClone(client, opts)
  const context = await recoveryContext(client, opts)
  const status = await runCheck(client, { ...opts, stagingLineageContext: context })
  assert.equal(status.applied, 15)
  await applyScopedMigrations(client, { ...opts, throughTag: '0015_deadline_engine_rls_fail_closed_closure', stagingLineageContext: context })
  assert.equal(client.state.rows.length, 16)
  assert.equal(client.state.rows.some((row) => BINDINGS.some((binding) => row.hash === binding.current)), false)
  assert.deepEqual(client.state.rows.slice(0, 15), opts.snapshot.ledger)
  client.state.receipt.executed[0].current = '0'.repeat(64)
  await assert.rejects(recoveryContext(client, opts), /receipt absent or inconsistent/)
})

test('context rejects wrong connection, changed canonical source and tampered anchors', { skip: !snapshotPath }, async () => {
  const opts = options()
  const client = fakeClient(opts.snapshot)
  client.connectionParameters.host = 'nzila-production-db.postgres.database.azure.com'
  await assert.rejects(planClone(client, opts), /not the authorized staging clone/)
  client.connectionParameters.host = TARGET_HOST
  await reconcileClone(client, opts)
  client.state.anchors.push({ rowCount: 15, digest: '0'.repeat(64) })
  await assert.rejects(recoveryContext(client, opts), /no longer match/)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ue-lineage-source-'))
  try {
    fs.writeFileSync(path.join(directory, BINDINGS[0].tag + '.sql'), 'SELECT 1;')
    await assert.rejects(planClone(client, { ...opts, migrationsDir: directory }), /Canonical source mismatch/)
  } finally { fs.rmSync(directory, { recursive: true }) }
})

test('shared ledger accepts interleaved canonical platform prefix but rejects unknown/gap/order/tamper', { skip: !snapshotPath }, async () => {
  const opts = options()
  const client = fakeClient(opts.snapshot)
  await reconcileClone(client, opts)
  const platform = lineageJournals(opts).find((journal) => journal.name === 'platform')
  assert.ok(platform.entries.length >= 2)
  const scoped = scopedLedgerJournal(opts)
  const baseline = structuredClone(client.state.rows)
  const append = (hash) => client.state.rows.push({ id: client.state.rows.length + 1, hash, created_at: '1790000000000' })
  append(platform.entries[0].hash)
  append(scoped.entries[15].hash)
  append(platform.entries[1].hash)
  const context = await recoveryContext(client, opts)
  assert.ok(context.appliedHashes.has(platform.entries[0].hash))
  assert.ok(context.appliedHashes.has(scoped.entries[15].hash))
  await assertMigrationLedgerIntegrity(client, { journals: [scoped], stagingLineageContext: context })
  assert.deepEqual(client.state.rows.slice(0, 15), opts.snapshot.ledger)
  const invalidSuffixes = [
    ['0'.repeat(64)],
    [platform.entries[1].hash],
    [platform.entries[1].hash, platform.entries[0].hash],
    [platform.entries[0].hash, '1'.repeat(64)],
    [platform.entries[0].hash, platform.entries[0].hash],
  ]
  for (const suffix of invalidSuffixes) {
    client.state.rows = structuredClone(baseline)
    for (const hash of suffix) append(hash)
    await assert.rejects(recoveryContext(client, opts), /Recovered ledger integrity/)
  }
  client.state.rows = structuredClone(baseline)
  client.state.rows[0].hash = '2'.repeat(64)
  await assert.rejects(recoveryContext(client, opts), /baseline prefix changed/)
})

test('failed actual DDL transaction restores disposable PostgreSQL catalog and ledger', {
  skip: !snapshotPath || !process.env.UE_LINEAGE_TEST_LOCAL_PG_URL,
}, async () => {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.UE_LINEAGE_TEST_LOCAL_PG_URL })
  await client.connect()
  try {
    // The test database must be disposable. No Azure target or role is contacted.
    const identity = (await client.query('SELECT current_database() AS database')).rows[0]
    assert.equal(identity.database, 'ue_lineage_disposable')
    const opts = options()
    await client.query('CREATE SCHEMA drizzle')
    await client.query('CREATE TABLE drizzle.__drizzle_migrations (id integer PRIMARY KEY, hash text, created_at bigint)')
    for (const row of opts.snapshot.ledger) await client.query('INSERT INTO drizzle.__drizzle_migrations VALUES ($1,$2,$3)', [row.id, row.hash, row.created_at])
    await client.query('CREATE ROLE union_eyes_runtime; CREATE ROLE union_eyes_system')
    const before = (await client.query('SELECT id, hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY id')).rows
    let observedDdl = 0
    const wrapper = {
      connectionParameters: { host: TARGET_HOST, database: TARGET_DATABASE },
      async query(sql, values) {
        // Only transport identity is simulated; all transactions, locks, ledger,
        // actual pinned migration DDL and rollback execute on real PostgreSQL.
        if (sql.startsWith('SELECT current_database() AS database, ssl')) return { rows: [{ database: TARGET_DATABASE, ssl: true }] }
        if (/CREATE OR REPLACE FUNCTION/.test(sql)) observedDdl++
        return client.query(sql, values)
      },
    }
    await assert.rejects(reconcileClone(wrapper, opts))
    assert.ok(observedDdl > 0, 'actual canonical DDL must execute before rollback')
    assert.deepEqual((await client.query('SELECT id, hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY id')).rows, before)
    assert.equal((await client.query("SELECT to_regclass('drizzle.ue_staging_lineage_recovery') AS relation")).rows[0].relation, null)
    assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'ue_create_%'")).rows[0].n, 0)
  } finally { await client.end() }
})
