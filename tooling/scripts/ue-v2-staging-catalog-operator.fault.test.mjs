/**
 * Fault injection against the exact operator programme the image ships (containerSource()).
 * A scripted stand-in for `pg` answers its catalogue queries, records every statement in
 * order, and fails on demand. It proves statement ordering, refusals before any data read,
 * and that no privileged value or error text escapes on any failure path. The Docker proof
 * covers the same programme against real PostgreSQL 16.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { PRIVILEGED_LOGIN, RUNTIME_LOGIN, RUNTIME_ROLE, STAGING_DB_HOST, containerSource, evaluateCatalogCompleteness, generateRecipientKeyPair, openSealedCatalog } from './ue-v2-staging-catalog-exec.mjs'
import { privilegedClearDefect, reassembleCatalog, sessionPlaneDefect } from './ue-v2-staging-catalog-job.mjs'

const RUN = '4343'
const SHA = 'b'.repeat(40)
const SECRET_VALUE = '9183'
const LEDGER_HASH = 'ledger-hash-secret-value'

// The scripted driver. Behaviour comes from FAKE_PG (JSON): login, superuser, bypass,
// rlsActive, isolation, failOn (substring), failCode, failMessage, dropOn (substring).
const FAKE_PG = String.raw`
const fs = require('fs')
const spec = JSON.parse(process.env.FAKE_PG || '{}')
const log = (line) => fs.appendFileSync(process.env.FAKE_PG_LOG, JSON.stringify(line) + '\n')
const tables = [['public', 'members'], ['public', 'claims'], ['drizzle', '__drizzle_migrations']]
class Client {
  constructor(config) {
    // As node-postgres does: every query parameter of the connection string overlays the config.
    if (config.connectionString) {
      const url = new URL(config.connectionString)
      const parsed = { user: decodeURIComponent(url.username) }
      for (const [key, value] of url.searchParams) parsed[key] = value
      config = Object.assign({}, config, parsed)
    }
    this.config = config; this.open = false; this.readOnly = /default_transaction_read_only=on/.test(String(config.options || '')) }
  async connect() { log({ connect: { user: this.config.user ?? null, options: this.config.options ?? null, ssl: this.config.ssl === false ? false : Boolean(this.config.ssl), host: this.config.host ?? null } }); if (spec.connectFail) { const e = new Error('connect ECONNREFUSED ' + spec.connectFail); e.code = 'ECONNREFUSED'; throw e } }
  async end() { log({ end: true }) }
  async query(sql) {
    log({ sql, open: this.open })
    if (spec.dropOn && sql.includes(spec.dropOn)) { const e = new Error('Connection terminated unexpectedly'); throw e }
    if (spec.failOn && sql.includes(spec.failOn) && !/^(SAVEPOINT|RELEASE|ROLLBACK)/.test(sql)) {
      const e = new Error(spec.failMessage || 'boom'); e.code = spec.failCode || 'XX000'; throw e
    }
    if (/^BEGIN/.test(sql)) { this.open = true; this.isolation = /REPEATABLE READ/.test(sql) ? 'repeatable read' : 'read committed'; return { rowCount: 0, rows: [] } }
    if (sql === 'ROLLBACK') { this.open = false; return { rowCount: 0, rows: [] } }
    if (/^(SET LOCAL|SAVEPOINT|RELEASE|ROLLBACK TO)/.test(sql)) return { rowCount: 0, rows: [] }
    if (!this.open) throw new Error('statement outside transaction: ' + sql)
    const login = spec.login || 'uev2admin'
    const user = spec.actingRole || login
    const rows = (list) => ({ rowCount: list.length, rows: list })
    if (sql.includes('AS transaction_read_only')) return rows([{ version: 'PostgreSQL 16.15', database: spec.database || 'ue_v2_staging', user, session_user: login, transaction_read_only: 'on', default_read_only: this.readOnly ? 'on' : 'off', isolation: spec.isolation || this.isolation, row_security: 'on', track_counts: spec.trackCounts || 'on', snapshot: '777:777:', transaction_started_at: new Date('2026-11-27T00:00:00Z') }])
    if (sql.includes('FROM pg_roles WHERE rolname IN')) return rows([...new Set([user, login])].map((name) => ({ rolname: name, rolsuper: Boolean(spec.superuser), rolbypassrls: Boolean(spec.bypass), rolcreatedb: false, rolcreaterole: false, acting: name === user })))
    if (sql.includes('FROM pg_stat_user_tables')) return rows(tables.map(([schema, name], index) => ({ oid: String(16000 + index), schema, name, ins: String(spec.secretCounter || 5), upd: '0', del: '0', filenode: String(17000 + index) })))
    if (sql.includes('has_schema_privilege(current_user, n.oid, \'USAGE\') AS schema_usage, has_table_privilege(current_user, c.oid, \'SELECT\') AS can_select FROM')) return rows([{ schema: 'drizzle', name: '__drizzle_migrations', schema_usage: !spec.ledgerDenied, can_select: !spec.ledgerDenied }])
    if (sql.includes('AS column_name')) return rows([{ table_schema: 'drizzle', table_name: '__drizzle_migrations', column_name: 'hash', data_type: 'text' }])
    if (sql.includes('pg_has_role(current_user, r.oid, \'MEMBER\')')) return rows([{ rolname: user }, { rolname: 'pg_read_all_data' }])
    if (sql.includes('AS columns')) return rows([{ columns: 7, digest: 'a'.repeat(32) }])
    if (sql.includes('AS relations')) return rows([{ relations: 3, digest: 'b'.repeat(32), policy_digest: 'c'.repeat(32) }])
    if (sql.includes('row_security_active')) return rows(tables.map(([schema, name]) => ({ schema, name, owner: 'ue_v2_owner', rls: true, force: true, schema_usage: true, can_select: true, acts_as_owner: false, rls_active: spec.rlsActive !== undefined ? spec.rlsActive : !spec.bypass })))
    if (sql.startsWith('SELECT n.nspname AS schema, c.relname AS name FROM pg_class')) return rows(tables.map(([schema, name]) => ({ schema, name })))
    if (sql.includes('FROM drizzle.__drizzle_migrations')) return rows([{ id: 1, hash: ${JSON.stringify(LEDGER_HASH)}, created_at: '1767225600000' }])
    if (sql.startsWith('SELECT count(*)::bigint AS n FROM ONLY')) return rows([{ n: ${JSON.stringify(SECRET_VALUE)} }])
    return rows([])
  }
}
module.exports = { Client }
`

function harness() {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-operator-fault-'))
  mkdirSync(path.join(directory, 'node_modules', 'pg'), { recursive: true })
  writeFileSync(path.join(directory, 'node_modules', 'pg', 'index.js'), FAKE_PG)
  writeFileSync(path.join(directory, 'node_modules', 'pg', 'package.json'), JSON.stringify({ name: 'pg', version: '0.0.0-fake', main: 'index.js' }))
  writeFileSync(path.join(directory, 'operator.cjs'), containerSource())
  return directory
}

function operate(directory, { plane = 'privileged', fake = {}, env = {}, recipient } = {}) {
  const log = path.join(directory, `pg-${Math.random().toString(36).slice(2)}.log`)
  writeFileSync(log, '')
  const base = plane === 'privileged'
    ? { UE_CATALOG_PLANE: 'privileged', PGHOST: STAGING_DB_HOST, PGUSER: PRIVILEGED_LOGIN, PGPASSWORD: 'x', ...(recipient ? { UE_CATALOG_EVIDENCE_RECIPIENT: recipient } : {}) }
    : { DATABASE_URL: ['postgres', 'ql://', RUNTIME_LOGIN, '@db/ue_v2_staging'].join('') }
  const result = spawnSync(process.execPath, [path.join(directory, 'operator.cjs')], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_PATH: '', UE_CATALOG_TRANSPORT: 'private-job', UE_CATALOG_RUN_ID: RUN, UE_CATALOG_SOURCE_SHA: SHA, FAKE_PG: JSON.stringify(fake), FAKE_PG_LOG: log, ...base, ...env },
  })
  const lines = result.stdout.split('\n').filter((line) => line.startsWith('UE_CATALOG_V2 '))
  const evidence = reassembleCatalog(lines, { runId: RUN, source: SHA })
  const statements = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  return { result, evidence, body: evidence.ok ? JSON.parse(evidence.body) : null, statements, sql: statements.filter((item) => item.sql).map((item) => item.sql) }
}

const recipient = generateRecipientKeyPair()
// Local proof mode (non-Azure host, TLS off) is the only mode that may shorten the settle wait.
const settleFast = { PGHOST: 'fake-db', UE_CATALOG_PG_TLS: 'disable-for-local-proof', UE_CATALOG_STATS_SETTLE_MS: '0' }

test('the privileged session opens read-only, refuses before reading, and only reads', () => {
  const directory = harness()
  try {
    // Against the staging host: verified TLS, the fixed login, a read-only session default.
    const staging = operate(directory, { fake: { bypass: true, connectFail: 'staging' }, recipient: recipient.publicKey })
    assert.deepEqual(staging.statements[0].connect, { user: PRIVILEGED_LOGIN, options: '-c default_transaction_read_only=on', ssl: true, host: STAGING_DB_HOST })
    const stagingSettle = operate(directory, { fake: { bypass: true, connectFail: 'staging' }, recipient: recipient.publicKey, env: { UE_CATALOG_STATS_SETTLE_MS: '0' } })
    assert.equal(stagingSettle.body.statsSettleTargetMs, 75000, 'the settle interval cannot be shortened against Azure')
    const { body, sql, statements, result } = operate(directory, { fake: { bypass: true }, recipient: recipient.publicKey, env: settleFast })
    assert.equal(result.stderr, '', 'nothing is written to stderr')
    assert.deepEqual(statements[0].connect, { user: PRIVILEGED_LOGIN, options: '-c default_transaction_read_only=on', ssl: false, host: 'fake-db' })
    assert.equal(sql[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    assert.deepEqual(sql.slice(1, 4), ["SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '2s'", 'SET LOCAL search_path = pg_catalog'])
    assert.ok(statements.filter((item) => item.sql && !/^(BEGIN|ROLLBACK)$|^BEGIN /.test(item.sql)).every((item) => item.open), 'no statement runs outside a transaction')
    for (const statement of sql) assert.match(statement, /^(BEGIN( ISOLATION LEVEL REPEATABLE READ)? READ ONLY|ROLLBACK|SET LOCAL (statement_timeout|lock_timeout|search_path) = |SAVEPOINT ue_cat_|RELEASE SAVEPOINT ue_cat_|ROLLBACK TO SAVEPOINT ue_cat_|SELECT )/, statement)
    assert.equal(sql.filter((item) => item === 'ROLLBACK').length, 2, 'the counting transaction and the settle read both end in ROLLBACK')
    assert.equal(body.rolledBack, true)
    assert.equal(body.blocker, undefined)
    assert.equal(sessionPlaneDefect(body, 'privileged', recipient.keyId), null)
    assert.equal(privilegedClearDefect(body), null)
    const text = JSON.stringify(body)
    assert.equal(text.includes(SECRET_VALUE) || text.includes(LEDGER_HASH), false, 'no count or ledger value in the clear')
    const opened = openSealedCatalog(body, recipient.privateKeyPem)
    assert.equal(opened.run, RUN)
    assert.ok(opened.catalog.counts.filter((item) => item.classification === 'OBSERVED').every((item) => item.n === SECRET_VALUE))
    assert.equal(opened.catalog.queries.find((item) => item.id === 'drizzle_rows').rows[0].hash, LEDGER_HASH)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('refusals happen before any data is read: key, target, login, superuser, statistics, isolation', () => {
  const directory = harness()
  const dataRead = (sql) => sql.some((statement) => /count\(\*\)|__drizzle_migrations ORDER BY|pg_stat_user_tables/.test(statement))
  try {
    const keyless = operate(directory, { fake: { bypass: true } })
    assert.equal(keyless.body.blocker, 'EVIDENCE_RECIPIENT_MISSING')
    assert.equal(keyless.statements.length, 0, 'no connection without the sealing key')
    const wrongHost = operate(directory, { fake: { bypass: true }, recipient: recipient.publicKey, env: { PGHOST: 'nzila-ue-v2-prod-db.postgres.database.azure.com', UE_CATALOG_PG_TLS: 'disable-for-local-proof' } })
    assert.equal(wrongHost.body.blocker, 'WRONG_TARGET')
    assert.equal(wrongHost.statements.length, 0, 'TLS cannot be disabled for an Azure server, and only staging is accepted')
    const otherUser = operate(directory, { fake: { bypass: true }, recipient: recipient.publicKey, env: { PGUSER: 'azuresu' } })
    assert.equal(otherUser.body.blocker, 'PRIVILEGED_CREDENTIAL_ABSENT')
    assert.equal(otherUser.statements.length, 0)
    for (const [fake, blocker] of [
      [{ bypass: true, superuser: true }, 'PRIVILEGE_REFUSED'],
      [{ bypass: true, login: 'azuresu' }, 'IDENTITY_REFUSED'],
      [{ bypass: true, trackCounts: 'off' }, 'STATS_UNTRACKED'],
      [{ bypass: true, isolation: 'read committed' }, 'IDENTITY_REFUSED'],
      [{ bypass: true, database: 'postgres' }, 'IDENTITY_REFUSED'],
    ]) {
      const run = operate(directory, { fake, recipient: recipient.publicKey, env: settleFast })
      assert.equal(run.body.blocker, blocker, JSON.stringify(fake))
      assert.equal(dataRead(run.sql), false, `${blocker}: nothing is read`)
      assert.equal(run.sql.at(-1), 'ROLLBACK')
      assert.equal(run.body.rolledBack, true)
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('without BYPASSRLS nothing is a global total, whatever the login is called', () => {
  const directory = harness()
  try {
    const { body } = operate(directory, { fake: { bypass: false }, recipient: recipient.publicKey, env: settleFast })
    assert.ok(body.counts.every((item) => item.countScope !== 'GLOBAL' && item.globalTotal === false))
    const lying = operate(directory, { fake: { bypass: false, rlsActive: false }, recipient: recipient.publicKey, env: settleFast })
    const opened = openSealedCatalog(lying.body, recipient.privateKeyPem).catalog
    // row_security_active said false but no attribute explains it: the evaluator refuses the scope.
    const counts = evaluateCatalogCompleteness(opened).categories.find((category) => category.id === 'preservation_counts')
    assert.equal(counts.accepted, false)
    assert.ok(counts.items.filter((item) => item.name !== '__drizzle_migrations').every((item) => item.classification === 'SCOPE_UNPROVEN'), JSON.stringify(counts.tally))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('every failure path ends in ROLLBACK and leaks no value or error text', () => {
  const directory = harness()
  const leaky = `value ${SECRET_VALUE} in row (${LEDGER_HASH})`
  try {
    for (const fake of [
      { bypass: true, failOn: 'count(*)', failCode: '42501', failMessage: leaky },
      { bypass: true, failOn: 'count(*)', failCode: '57014', failMessage: 'canceling statement due to statement timeout' },
      { bypass: true, failOn: '__drizzle_migrations ORDER BY', failCode: '22P02', failMessage: leaky },
      { bypass: true, dropOn: 'count(*)' },
      { bypass: true, dropOn: 'settled' },
      { bypass: true, failOn: 'row_security_active', failMessage: leaky },
    ]) {
      const run = operate(directory, { fake, recipient: recipient.publicKey, env: settleFast })
      const text = JSON.stringify(run.body)
      assert.equal(run.result.stderr, '', JSON.stringify(fake))
      assert.equal(text.includes(SECRET_VALUE) || text.includes(LEDGER_HASH), false, `no value escapes: ${JSON.stringify(fake)}`)
      assert.equal(privilegedClearDefect(run.body), null, JSON.stringify(fake))
      assert.ok(run.sql.includes('ROLLBACK'), JSON.stringify(fake))
      if (fake.failCode === '57014') assert.ok(run.body.counts.some((item) => item.classification === 'TIMED_OUT'))
    }
    const refused = operate(directory, { fake: { bypass: true, connectFail: 'db:5432' }, recipient: recipient.publicKey, env: settleFast })
    assert.match(refused.body.error, /^SQLSTATE ECONNREFUSED$/)
    assert.equal(sessionPlaneDefect(refused.body, 'privileged', recipient.keyId), 'DATABASE_CONNECTION_REFUSED')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('the runtime plane sets the runtime role and a read-only session, and never seals or carries the admin path', () => {
  const directory = harness()
  try {
    const { body, statements, sql } = operate(directory, { plane: 'runtime', fake: { login: RUNTIME_LOGIN, actingRole: RUNTIME_ROLE } })
    assert.equal(statements[0].connect.options, `-c role=${RUNTIME_ROLE} -c default_transaction_read_only=on`)
    assert.equal(sql[0], 'BEGIN READ ONLY')
    assert.equal(body.plane, 'runtime')
    assert.equal(body.sealed, undefined)
    assert.equal(sql.some((statement) => statement.includes('pg_stat_user_tables')), false)
    assert.equal(body.identity.user, RUNTIME_ROLE)
    assert.equal(sessionPlaneDefect(body, 'runtime'), null)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('options carried inside DATABASE_URL cannot drop the read-only session default', () => {
  // Run 46019964268: the staging database-url carries its own options= (the role), which
  // node-postgres lays over a separate options field, so the session started without
  // default_transaction_read_only and the identity check refused it.
  const directory = harness()
  const password = 'p@ss:w/rd'
  const withOptions = ['postgres', 'ql://', RUNTIME_LOGIN, ':', encodeURIComponent(password), '@db:5432/ue_v2_staging?sslmode=require&options=-c%20role%3D', RUNTIME_ROLE].join('')
  try {
    const { body, statements, result } = operate(directory, { plane: 'runtime', fake: { login: RUNTIME_LOGIN, actingRole: RUNTIME_ROLE }, env: { DATABASE_URL: withOptions } })
    assert.equal(statements[0].connect.options, `-c role=${RUNTIME_ROLE} -c role=${RUNTIME_ROLE} -c default_transaction_read_only=on`, 'ours follow the URL options, so PostgreSQL applies them last')
    assert.equal(statements[0].connect.user, RUNTIME_LOGIN)
    assert.equal(body.blocker, undefined)
    assert.equal(body.identity.default_read_only, 'on')
    assert.equal(sessionPlaneDefect(body, 'runtime'), null)
    assert.equal(`${result.stdout}${result.stderr}`.includes(password) || `${result.stdout}`.includes(encodeURIComponent(password)), false, 'the credential never reaches the evidence')

    const garbled = operate(directory, { plane: 'runtime', fake: { login: RUNTIME_LOGIN, actingRole: RUNTIME_ROLE }, env: { DATABASE_URL: 'not a url' } })
    assert.equal(garbled.body.blocker, 'DATABASE_URL_UNPARSEABLE')
    assert.equal(garbled.statements.length, 0, 'nothing connects')
    assert.equal(sessionPlaneDefect(garbled.body, 'runtime'), 'DATABASE_CONNECTION_REFUSED')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('every statement the operator issues parses as PostgreSQL', async () => {
  // libpg-query is the PostgreSQL parser itself (compiled to WebAssembly), already a
  // dependency of the Union Eyes app. A scripted driver cannot catch a syntax error.
  const { createRequire } = await import('node:module')
  const repository = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
  const parser = createRequire(path.join(repository, 'apps/union-eyes/package.json'))('libpg-query')
  await parser.loadModule()
  const directory = harness()
  try {
    const statements = new Set([
      ...operate(directory, { fake: { bypass: true }, recipient: recipient.publicKey, env: settleFast }).sql,
      ...operate(directory, { plane: 'runtime', fake: { login: RUNTIME_LOGIN, actingRole: RUNTIME_ROLE } }).sql,
      ...operate(directory, { fake: { bypass: true, failOn: 'count(*)', failCode: '42501' }, recipient: recipient.publicKey, env: settleFast }).sql,
    ])
    assert.ok(statements.size >= 25, `only ${statements.size} statements observed`)
    for (const statement of statements) {
      assert.doesNotThrow(() => parser.parseSync(statement), statement)
      const tree = parser.parseSync(statement)
      assert.equal(tree.stmts.length, 1, `one statement per call: ${statement}`)
      const kind = Object.keys(tree.stmts[0].stmt)[0]
      assert.ok(['SelectStmt', 'TransactionStmt', 'VariableSetStmt'].includes(kind), `${kind}: ${statement}`)
    }
    assert.throws(() => parser.parseSync("SELECT (SELECT md5('x'))) FROM pg_policy"), 'the parser rejects the defect this test exists for')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
