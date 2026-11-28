/**
 * One read-only catalogue session inside the serving Union Eyes V2 staging revision.
 *
 * The runner uses the existing ue-staging deploy identity. It checks that identity's
 * live role definitions for Microsoft.App/containerApps/exec/action, rechecks the
 * serving revision, then opens one container exec. The container uses its own
 * DATABASE_URL and the pg driver already externalized into the image. This file
 * never prints that URL, an access token, or an environment dump.
 */
import { spawnSync } from 'node:child_process'
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const REPOSITORY = 'anungis437/nzila-os'
export const DEFAULT_REF = 'refs/heads/main'
export const SUBSCRIPTION_ID = 'd562ba7f-d891-4504-a489-10917c0ebaaf'
export const TENANT_ID = 'cc15259a-d2bf-421f-8e44-dccf8dc6232a'
export const RESOURCE_GROUP = 'nzila-canada-staging-rg'
export const CONTAINER_APP = 'nzila-ue-v2-staging-app'
export const CONTAINER_NAME = 'union-eyes'
export const EXPECTED_REVISION = 'nzila-ue-v2-staging-app--rel6a60c95c9d'
export const EXPECTED_IMAGE = 'nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:2bf18216fda45d71395b6396ec65b3974745f5446696d378f6ea6d37fe2e67ef'
export const EXPECTED_DATABASE = 'ue_v2_staging'
export const CATALOG_SCHEMA = 'ue-v2-staging-catalog/v2'
export const COUNT_WALL_BUDGET_MS = 45000
// Founder-authorized 2026-11-27 (option E): at least the 790 staging tables in one session, so the
// privileged plane is one REPEATABLE READ snapshot. Staging's 5-minute scheduled writers made every
// multi-session chain refuse (DATA_DRIFT_BETWEEN_SESSIONS, run 46072263185). The 15 s statement
// timeout and 45 s wall budget still bound the session; 250 counts took about 2.3 s on staging.
export const COUNT_MAX_STATEMENTS = 1000
export const SOURCE_TABLE_DECLARATIONS = 1224
// The application's runtime login holds its role with INHERIT FALSE, so a session
// only carries runtime privileges after `-c role=`. The catalogue inspects exactly
// that role, as the application and the forward-upgrade preflight do.
export const RUNTIME_ROLE = 'union_eyes_runtime'
export const RUNTIME_LOGIN = 'ue_staging_runtime'
// Plane B: the existing staging administrator login. It is not a superuser; it holds
// BYPASSRLS and, through azure_pg_admin, pg_read_all_data. It is used read-only, in a
// REPEATABLE READ transaction that ends in ROLLBACK, and only by founder dispatch.
export const PRIVILEGED_LOGIN = 'uev2admin'
export const CATALOG_PLANES = ['runtime', 'privileged']
// Privileged values (exact counts, migration ledger, change counters) leave the
// container only sealed to the founder's X25519 key. The repository is public, so
// Actions artifacts and workspace logs are treated as broadly readable.
export const SEAL_SCHEME = 'X25519-HKDF-SHA256-AES-256-GCM/v1'
const SEAL_INFO = 'ue-v2-staging-catalog-sealed/v1'
export const STAGING_DB_HOST = 'nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com'
// After its counting transaction ends, a privileged session waits until this long after
// its snapshot before re-reading the cumulative statistics. PostgreSQL flushes a busy
// backend's pending counters at least every 60 s (an idle one after 10 s), so a write
// committed inside any session's window is visible to that session's closing read.
export const STATS_SETTLE_MS = 75000
// Private-job evidence frame v2: exact UTF-8 bytes, base64 per line. 6000 bytes is
// 8000 base64 characters, well under the 16384-character container log line split.
export const EVIDENCE_FRAME = 'UE_CATALOG_V2'
export const EVIDENCE_CHUNK_BYTES = 6000
export const EVIDENCE_MAX_BYTES = 32 * 1024 * 1024
export const EVIDENCE_MAX_CHUNKS = Math.ceil(EVIDENCE_MAX_BYTES / EVIDENCE_CHUNK_BYTES)
export const EXEC_ACTION = 'Microsoft.App/containerApps/exec/action'
export const GROUP_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}`

const MARK_BEGIN = 'UE_CATALOG_BEGIN'
const MARK_END = 'UE_CATALOG_END'

export function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[redacted]')
    .replace(/\b(password|pwd|secret|token|accountkey)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted-jwt]')
}

export function principalFromAccessToken(token) {
  const part = String(token).split('.')[1]
  if (!part) throw new Error('ACCESS_TOKEN_UNREADABLE')
  const payload = JSON.parse(Buffer.from(part, 'base64url').toString())
  if (!payload.oid || !payload.tid) throw new Error('ACCESS_TOKEN_WITHOUT_CALLER')
  return { oid: payload.oid, appid: payload.appid ?? null, tid: payload.tid }
}

export function actionCovers(action, target) {
  if (action === '*' || action === target) return true
  if (typeof action === 'string' && action.endsWith('/*')) return target.startsWith(action.slice(0, -1))
  if (typeof action === 'string' && action.endsWith('*')) return target.startsWith(action.slice(0, -1))
  return false
}

export function roleCoversExec(definition) {
  const permissions = Array.isArray(definition?.permissions)
    ? definition.permissions
    : definition?.actions ? [definition] : []
  const actions = permissions.flatMap((item) => item.actions ?? [])
  const notActions = permissions.flatMap((item) => item.notActions ?? [])
  const allowed = actions.some((action) => actionCovers(action, EXEC_ACTION))
  const excluded = notActions.some((action) => actionCovers(action, EXEC_ACTION))
  return allowed && !excluded
}

export function containerSource() {
  return `
const BEGIN = ${JSON.stringify(MARK_BEGIN)}
const END = ${JSON.stringify(MARK_END)}
const SCHEMA = ${JSON.stringify(CATALOG_SCHEMA)}
const COUNT_WALL_BUDGET_MS = ${COUNT_WALL_BUDGET_MS}
const COUNT_MAX_STATEMENTS = ${COUNT_MAX_STATEMENTS}
const SOURCE_TABLE_DECLARATIONS = ${SOURCE_TABLE_DECLARATIONS}
const RUNTIME_ROLE = ${JSON.stringify(RUNTIME_ROLE)}
const FRAME = ${JSON.stringify(EVIDENCE_FRAME)}
const CHUNK_BYTES = ${EVIDENCE_CHUNK_BYTES}
const MAX_BYTES = ${EVIDENCE_MAX_BYTES}
const PRIVILEGED_LOGIN = ${JSON.stringify(PRIVILEGED_LOGIN)}
const STAGING_DB_HOST = ${JSON.stringify(STAGING_DB_HOST)}
const STATS_SETTLE_MS = ${STATS_SETTLE_MS}
const SEAL_INFO = ${JSON.stringify(SEAL_INFO)}
function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\\/\\/[^\\s'"]+/gi, 'postgresql://[redacted]')
    .replace(/\\b(password|pwd|secret|token|accountkey)\\s*[:=]\\s*\\S+/gi, '$1=[redacted]')
}
const crypto = require('crypto')
function ident(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('IDENTIFIER_REFUSED')
  return '"' + value.replaceAll('"', '""') + '"'
}
function inventoryDigest(rows) {
  return crypto.createHash('sha256').update(rows.map((row) => row.schema + '.' + row.name).sort().join('\\n')).digest('hex')
}
function errorCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : ''
  return /^[A-Z0-9_]{1,32}$/.test(code) ? code : 'unknown'
}
// A privileged error message can quote a value; only its code leaves the container.
function errorText(error) {
  return PLANE === 'privileged' ? 'SQLSTATE ' + errorCode(error) : redact(error && error.message)
}
function failed(id, error) {
  const timedOut = errorCode(error) === '57014' || /statement timeout|canceling statement/i.test(String(error && error.message))
  return { id, error: errorText(error), sqlstate: errorCode(error), classification: timedOut ? 'TIMED_OUT' : 'UNREADABLE' }
}
async function query(client, id, sql) {
  const save = 'ue_cat_' + id.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
  await client.query('SAVEPOINT ' + save)
  try {
    const result = await client.query(sql)
    await client.query('RELEASE SAVEPOINT ' + save)
    return { id, rowCount: result.rowCount, rows: result.rows }
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT ' + save)
    return failed(id, error)
  }
}
const PLANE = process.env.UE_CATALOG_PLANE === 'privileged' ? 'privileged' : 'runtime'
const SEAL_SCHEME = ${JSON.stringify(SEAL_SCHEME)}
// Relation and policy metadata, hashed server-side: ownership, ACL, RLS flags and policy
// expressions that change between sessions or planes are drift, not a merge.
const RELATIONS_SQL = "SELECT count(*)::int AS relations, md5(coalesce(string_agg(c.oid::text || ':' || n.nspname || '.' || c.relname || ':' || c.relkind::text || ':' || pg_get_userbyid(c.relowner) || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, ',' ORDER BY c.oid), '')) AS digest, (SELECT md5(coalesce(string_agg(pol.oid::text || ':' || pol.polname || ':' || pol.polcmd::text || ':' || pol.polpermissive::text || ':' || array_to_string(pol.polroles, ',') || ':' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ':' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''), ',' ORDER BY pol.oid), '')) FROM pg_policy pol) AS policy_digest FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p','v','m','S','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'"
const COUNTERS_SQL = 'SELECT s.relid::text AS oid, s.schemaname AS schema, s.relname AS name, s.n_tup_ins::text AS ins, s.n_tup_upd::text AS upd, s.n_tup_del::text AS del, c.relfilenode::text AS filenode FROM pg_stat_user_tables s JOIN pg_class c ON c.oid = s.relid ORDER BY 2, 3'
function countersDigest(rows) {
  return digestOf(rows.map((item) => [item.oid, item.schema, item.name, item.ins, item.upd, item.del, item.filenode].join(':')).join('\\n'))
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const MIGRATION_RELATIONS = "('__drizzle_migrations','drizzle_migrations','schema_migrations','django_migrations')"
const TABLES_SQL = "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"
// Catalogue facts only: pg_class, pg_namespace and the privilege functions need no
// schema USAGE, so an inaccessible table is recorded as inaccessible, never as absent.
// Column-level structure of every table, hashed server-side: drift between sessions or planes.
const STRUCTURE_SQL = "SELECT count(*)::int AS columns, md5(string_agg(n.nspname || '.' || c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' ORDER BY n.nspname, c.relname, a.attnum)) AS digest FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')"
// The privileges this session actually holds, including inherited predefined roles.
const EFFECTIVE_ROLES_SQL = "SELECT r.rolname FROM pg_roles r WHERE pg_has_role(current_user, r.oid, 'MEMBER') ORDER BY 1"
const MATRIX_SQL = "SELECT n.nspname AS schema, c.relname AS name, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls, c.relforcerowsecurity AS force, has_schema_privilege(current_user, n.oid, 'USAGE') AS schema_usage, has_table_privilege(current_user, c.oid, 'SELECT') AS can_select, pg_has_role(current_user, c.relowner, 'USAGE') AS acts_as_owner, row_security_active(c.oid) AS rls_active FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"
function digestOf(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
}
// PostgreSQL's own answer for this session (row_security_active), never an inference
// from the login name or role attributes.
function countScope(entry) {
  if (!entry || entry.schema_usage !== true || entry.can_select !== true) return null
  return entry.rls_active === false ? 'GLOBAL' : 'ROLE_VISIBLE'
}
async function main() {
  const out = { schema: SCHEMA, plane: PLANE, queries: [], counts: [], rolledBack: false }
  const sensitive = { counts: [], ledgers: [], modificationCounters: [], settledCounters: [] }
  let client
  let recipient = null
  let mainOpen = false
  let settleOpen = false
  let transactionStartedMs = 0
  try {
    let pg
    try { pg = require('pg') } catch { pg = null }
    out.client = { module: 'pg', resolved: Boolean(pg), psql: false }
    out.runtime = { uid: typeof process.getuid === 'function' ? process.getuid() : null, node: process.version, entry: __filename,
      pgPath: pg ? require.resolve('pg') : null, pgVersion: pg ? (() => { try { return require('pg/package.json').version } catch { return null } })() : null }
    if (!pg) { out.blocker = 'NO_IN_CONTAINER_PG_CLIENT'; return }
    if (PLANE === 'privileged') {
      // Privileged values leave the container only sealed to the founder's key; without it nothing connects.
      try { recipient = crypto.createPublicKey({ key: Buffer.from(String(process.env.UE_CATALOG_EVIDENCE_RECIPIENT || ''), 'base64'), format: 'der', type: 'spki' }) } catch { recipient = null }
      if (!recipient || recipient.asymmetricKeyType !== 'x25519') { recipient = null; out.blocker = 'EVIDENCE_RECIPIENT_MISSING'; return }
      if (process.env.PGUSER !== PRIVILEGED_LOGIN || !process.env.PGPASSWORD || !process.env.PGHOST) { out.blocker = 'PRIVILEGED_CREDENTIAL_ABSENT'; return }
      // Verified TLS to the staging server only; the local Docker proof may disable TLS, never for an Azure server.
      const localProof = process.env.UE_CATALOG_PG_TLS === 'disable-for-local-proof' && !/\\.postgres\\.database\\.azure\\.com$/i.test(process.env.PGHOST)
      if (!localProof && process.env.PGHOST !== STAGING_DB_HOST) { out.blocker = 'WRONG_TARGET'; return }
      out.statsSettleTargetMs = localProof && /^[0-9]{1,6}$/.test(String(process.env.UE_CATALOG_STATS_SETTLE_MS || '')) ? Number(process.env.UE_CATALOG_STATS_SETTLE_MS) : STATS_SETTLE_MS
      const tls = localProof ? false : { rejectUnauthorized: true, servername: process.env.PGHOST }
      // default_transaction_read_only: even a statement outside the transaction could not write.
      client = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), user: PRIVILEGED_LOGIN, password: process.env.PGPASSWORD,
        database: 'ue_v2_staging', ssl: tls, options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 15000, application_name: 'ue-s202-catalog-privileged' })
    } else {
      if (!process.env.DATABASE_URL) { out.blocker = 'DATABASE_URL_ABSENT'; return }
      // node-postgres lays every query parameter of the connection string over the client
      // config, so an options= in DATABASE_URL would silently replace a separate options
      // field. The session settings therefore go into the URL's own options, after any it
      // already carries, so PostgreSQL applies them last.
      let url
      try { url = new URL(process.env.DATABASE_URL) } catch { url = null }
      if (!url) { out.blocker = 'DATABASE_URL_UNPARSEABLE'; return }
      url.searchParams.set('options', [url.searchParams.get('options'), '-c role=' + RUNTIME_ROLE, '-c default_transaction_read_only=on'].filter(Boolean).join(' '))
      client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 15000, application_name: 'ue-s202-catalog' })
    }
    await client.connect()
    // The privileged plane reads one consistent snapshot per session; both planes are read-only.
    mainOpen = true
    await client.query(PLANE === 'privileged' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN READ ONLY')
    transactionStartedMs = Date.now()
    await client.query("SET LOCAL statement_timeout = '15s'")
    await client.query("SET LOCAL lock_timeout = '2s'")
    // Every name is schema-qualified, so digests and deparsed policies do not depend on the login.
    await client.query("SET LOCAL search_path = pg_catalog")
    const identity = await query(client, 'identity', "SELECT version() AS version, current_database() AS database, current_user AS \\"user\\", session_user AS session_user, current_setting('transaction_read_only') AS transaction_read_only, current_setting('default_transaction_read_only') AS default_read_only, current_setting('transaction_isolation') AS isolation, current_setting('row_security') AS row_security, current_setting('track_counts') AS track_counts, pg_current_snapshot()::text AS snapshot, now() AS transaction_started_at")
    out.queries.push(identity)
    const row = identity.rows && identity.rows[0]
    out.identity = row ?? null
    const identityOk = row && row.transaction_read_only === 'on' && row.default_read_only === 'on' && row.database === 'ue_v2_staging' && (PLANE === 'privileged'
      ? row.user === PRIVILEGED_LOGIN && row.session_user === PRIVILEGED_LOGIN && row.isolation === 'repeatable read'
      : row.user === RUNTIME_ROLE)
    if (!identityOk) { out.blocker = 'IDENTITY_REFUSED'; return }
    out.observedAt = new Date().toISOString()
    out.snapshot = row.snapshot
    out.readOnlyCredential = false
    out.transport = process.env.UE_CATALOG_TRANSPORT || 'not-recorded'
    let continuation = null
    if (process.env.UE_CATALOG_CONTINUATION) {
      try { continuation = JSON.parse(process.env.UE_CATALOG_CONTINUATION) } catch { out.blocker = 'CONTINUATION_REJECTED'; return }
      if (!continuation || continuation.schema !== 'ue-v2-staging-catalog-continuation/v1' || continuation.database !== 'ue_v2_staging' || (continuation.plane || 'runtime') !== PLANE || !(continuation.expiresAt > out.observedAt)) { out.blocker = 'CONTINUATION_REJECTED'; return }
      out.sessionKind = 'continuation'
      out.baselineSessionId = continuation.baselineSessionId
    } else out.sessionKind = 'baseline'
    // Classify both the acting role and the login: a privileged login can RESET ROLE at will.
    const privilege = await query(client, 'privilege', 'SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolname = current_user AS acting FROM pg_roles WHERE rolname IN (current_user, session_user) ORDER BY rolname')
    out.queries.push(privilege)
    const privilegeRows = Array.isArray(privilege.rows) ? privilege.rows : []
    const actingRow = privilegeRows.find((item) => item.acting === true)
    const elevated = privilegeRows.some((item) => item.rolsuper === true || item.rolbypassrls === true || item.rolcreatedb === true || item.rolcreaterole === true)
    out.privilege = actingRow ? { user: actingRow.rolname, login: (privilegeRows.find((item) => item.acting !== true) || actingRow).rolname, rolsuper: privilegeRows.some((item) => item.rolsuper === true), rolbypassrls: actingRow.rolbypassrls === true, loginBypassrls: privilegeRows.some((item) => item.rolbypassrls === true), classification: elevated ? 'ELEVATED' : 'LIMITED_RUNTIME', readOnlyCredential: false } : { classification: 'UNREADABLE', readOnlyCredential: false }
    if (PLANE === 'privileged') {
      // Global visibility must come from BYPASSRLS on exactly this login, never from superuser.
      if (!actingRow || out.privilege.rolsuper !== false || out.privilege.user !== PRIVILEGED_LOGIN) { out.blocker = 'PRIVILEGE_REFUSED'; return }
      // Without cumulative statistics, change between sessions cannot be detected.
      if (row.track_counts !== 'on') { out.blocker = 'STATS_UNTRACKED'; return }
      const opening = await query(client, 'modification_counters', COUNTERS_SQL)
      if (!Array.isArray(opening.rows)) { out.queries.push(opening); out.blocker = 'STATS_UNREADABLE'; return }
      sensitive.modificationCounters = opening.rows
      out.modificationDigest = countersDigest(opening.rows)
      out.queries.push({ id: 'modification_counters', rowCount: opening.rows.length, rowsSealed: true })
    }
    const posture = PLANE === 'privileged' ? [] : [
      ['roles', "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname"],
      ['memberships', "SELECT r.rolname AS role, m.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member ORDER BY 1, 2"],
      ['relations', "SELECT n.nspname AS schema, c.relname AS name, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','S') AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['rls', "SELECT n.nspname AS schema, c.relname AS name, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['policies', "SELECT n.nspname AS schema, c.relname AS name, pol.polname, pol.polcmd, pol.polpermissive, ARRAY(SELECT CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END FROM unnest(pol.polroles) r ORDER BY 1) AS roles, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace ORDER BY 1, 2, 3"],
      ['function', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'user_management' AND p.proname = 'auth_business_org_authorized'"],
      ['security_definer', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['event_trigger', "SELECT e.evtname, e.evtenabled, e.evtevent, n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid JOIN pg_namespace n ON n.oid = p.pronamespace WHERE e.evtname = 'ue_guard_deadline_reassignment_convergence_policy'"],
      // pg_class plus privilege functions: readable without USAGE on audit_security.
      ['audit', "SELECT n.nspname AS schema, c.relname AS rel, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl, c.relrowsecurity, c.relforcerowsecurity, has_schema_privilege(current_user, n.oid, 'USAGE') AS schema_usage, has_table_privilege(current_user, c.oid, 'SELECT') AS current_select, has_table_privilege(current_user, c.oid, 'INSERT') AS current_insert, has_table_privilege(current_user, c.oid, 'UPDATE') AS current_update, has_table_privilege(current_user, c.oid, 'DELETE') AS current_delete FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs'"],
      ['sequences', "SELECT n.nspname AS schema, c.relname AS name, s.seqstart::text AS seqstart, s.seqincrement::text AS seqincrement, pg_get_userbyid(c.relowner) AS owner FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
    ]
    const migration = [
      ['migration_relations', "SELECT n.nspname AS schema, c.relname AS name, has_schema_privilege(current_user, n.oid, 'USAGE') AS schema_usage, has_table_privilege(current_user, c.oid, 'SELECT') AS can_select FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relname IN " + MIGRATION_RELATIONS + " AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      // pg_attribute, not information_schema: the latter hides columns the role cannot see.
      ['migration_columns', "SELECT n.nspname AS table_schema, c.relname AS table_name, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relkind = 'r' AND c.relname IN " + MIGRATION_RELATIONS + " AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2, a.attnum"],
    ]
    // A privileged continuation re-reads the migration ledger so migration drift between
    // sessions is detected, not assumed away.
    const rereadMigration = !continuation || PLANE === 'privileged'
    const statements = [
      ...(rereadMigration ? migration : []),
      ...(continuation ? [] : posture),
      ['effective_roles', EFFECTIVE_ROLES_SQL],
      ['structure', STRUCTURE_SQL],
      ['relation_metadata', RELATIONS_SQL],
      ['tables', TABLES_SQL],
    ]
    for (const [id, sql] of statements) out.queries.push(await query(client, id, sql))
    const matrix = await query(client, 'privilege_matrix', MATRIX_SQL)
    out.queries.push(matrix)
    const matrixRows = Array.isArray(matrix.rows) ? matrix.rows : []
    const byName = new Map(matrixRows.map((entry) => [entry.schema + '.' + entry.name, entry]))
    if (rereadMigration) {
      const discovered = out.queries.find((item) => item.id === 'migration_relations')
      const drizzle = discovered && Array.isArray(discovered.rows) ? discovered.rows.find((item) => item.schema === 'drizzle' && item.name === '__drizzle_migrations') : null
      if (!discovered || discovered.error) out.queries.push({ id: 'drizzle_rows', classification: 'NOT_ATTEMPTED', reason: 'DISCOVERY_UNREADABLE' })
      else if (!drizzle) out.queries.push({ id: 'drizzle_rows', classification: 'NOT_ATTEMPTED', reason: 'RELATION_NOT_IN_DISCOVERY' })
      else if (!drizzle.schema_usage || !drizzle.can_select) out.queries.push({ id: 'drizzle_rows', classification: 'PRIVILEGE_DENIED', reason: 'MIGRATION_LEDGER_NOT_READABLE_BY_ROLE' })
      else {
        const ledger = await query(client, 'drizzle_rows', 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id')
        if (PLANE === 'privileged' && Array.isArray(ledger.rows)) {
          sensitive.ledgers.push({ relation: 'drizzle.__drizzle_migrations', rows: ledger.rows })
          out.queries.push({ id: 'drizzle_rows', rowCount: ledger.rows.length, rowsSealed: true, ledgerDigest: digestOf(ledger.rows) })
        } else out.queries.push(ledger)
      }
      if (PLANE === 'runtime' && !continuation) {
        const audit = out.queries.find((item) => item.id === 'audit')
        const auditAbsent = Boolean(audit && !audit.error && Array.isArray(audit.rows) && audit.rows.length === 0)
        if (auditAbsent) out.queries.push({ id: 'audit_grants', classification: 'NOT_ATTEMPTED', reason: 'PARENT_ABSENT' })
        else out.queries.push(await query(client, 'audit_grants', "SELECT r.rolname, a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a JOIN pg_roles r ON r.oid = a.grantee WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs' ORDER BY 1, 2"))
      }
    }
    const tables = out.queries.find((item) => item.id === 'tables')
    const names = tables && Array.isArray(tables.rows) ? tables.rows : []
    out.inventoryDigest = inventoryDigest(names)
    let targets = names
    if (continuation) {
      if (out.inventoryDigest !== continuation.inventoryDigest) { out.blocker = 'SCHEMA_DRIFT'; return }
      targets = Array.isArray(continuation.remaining) ? continuation.remaining : []
    }
    const started = Date.now()
    let attempted = 0
    out.countBudget = { wallBudgetMs: COUNT_WALL_BUDGET_MS, maxStatements: COUNT_MAX_STATEMENTS, sourceTableDeclarations: SOURCE_TABLE_DECLARATIONS, discovered: names.length, targeted: targets.length }
    for (const table of targets) {
      const scope = countScope(byName.get(table.schema + '.' + table.name))
      if (!scope) {
        // Deterministic refusal from catalogue privileges; no statement is spent on it.
        out.counts.push({ schema: table.schema, name: table.name, countScope: null, visibleToConnectedRole: false, globalTotal: false, classification: 'PRIVILEGE_DENIED', reason: 'NO_SELECT_OR_SCHEMA_USAGE' })
        continue
      }
      if (attempted >= COUNT_MAX_STATEMENTS || (Date.now() - started) > COUNT_WALL_BUDGET_MS) {
        out.counts.push({ schema: table.schema, name: table.name, countScope: scope, visibleToConnectedRole: true, globalTotal: scope === 'GLOBAL', classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET' })
        continue
      }
      attempted += 1
      let counted
      try {
        counted = await query(client, 'count_' + table.schema + '_' + table.name, 'SELECT count(*)::bigint AS n FROM ONLY ' + ident(table.schema) + '.' + ident(table.name))
      } catch (error) {
        counted = failed('count', error)
      }
      const n = counted.rows && counted.rows[0] ? String(counted.rows[0].n) : null
      const classification = counted.classification || (n === null ? 'UNREADABLE' : 'OBSERVED')
      if (PLANE === 'privileged' && classification === 'OBSERVED') {
        sensitive.counts.push({ schema: table.schema, name: table.name, n })
        out.counts.push({ schema: table.schema, name: table.name, countScope: scope, visibleToConnectedRole: true, globalTotal: scope === 'GLOBAL', classification, n: null, sealed: true })
      } else out.counts.push({ schema: table.schema, name: table.name, countScope: scope, visibleToConnectedRole: true, globalTotal: scope === 'GLOBAL', classification, n, error: counted.error })
    }
    out.sessionEndedAt = new Date().toISOString()
    await client.query('ROLLBACK')
    mainOpen = false
    out.rolledBack = true
    if (PLANE === 'privileged') {
      // Locks are released; wait out the statistics flush interval, then read the counters
      // again in a fresh read-only transaction. Any write inside this session's window shows.
      const wait = out.statsSettleTargetMs - (Date.now() - transactionStartedMs)
      if (wait > 0) await sleep(wait)
      settleOpen = true
      await client.query('BEGIN READ ONLY')
      await client.query("SET LOCAL statement_timeout = '15s'")
      const closing = await query(client, 'settled_counters', COUNTERS_SQL)
      await client.query('ROLLBACK')
      settleOpen = false
      out.statsSettledMs = Date.now() - transactionStartedMs
      if (!Array.isArray(closing.rows)) { out.queries.push(closing); out.blocker = 'STATS_UNREADABLE' }
      else {
        sensitive.settledCounters = closing.rows
        out.settledModificationDigest = countersDigest(closing.rows)
        out.queries.push({ id: 'settled_counters', rowCount: closing.rows.length, rowsSealed: true })
      }
    }
  } catch (error) {
    out.blocker = out.blocker || 'QUERY_FAILED'
    out.error = errorText(error)
  } finally {
    if (client) {
      if (mainOpen) {
        out.sessionEndedAt = out.sessionEndedAt || new Date().toISOString()
        try { await client.query('ROLLBACK'); out.rolledBack = true } catch { out.rolledBack = false }
      }
      if (settleOpen) { try { await client.query('ROLLBACK') } catch { out.blocker = out.blocker || 'QUERY_FAILED' } }
      try { await client.end() } catch { /* the session is abandoned */ }
    }
    if (PLANE === 'privileged') {
      const hasValues = sensitive.counts.length || sensitive.ledgers.length || sensitive.modificationCounters.length || sensitive.settledCounters.length
      if (hasValues && recipient) {
        try {
          const plain = Buffer.from(JSON.stringify(sensitive), 'utf8')
          const ephemeral = crypto.generateKeyPairSync('x25519')
          const salt = crypto.randomBytes(16)
          const iv = crypto.randomBytes(12)
          const key = Buffer.from(crypto.hkdfSync('sha256', crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient }), salt, Buffer.from(SEAL_INFO), 32))
          // The tag authenticates the run, source, session, plane and the exact clear summary.
          const clearSha256 = digestOf(JSON.stringify(out))
          const aad = [SEAL_INFO, String(process.env.UE_CATALOG_RUN_ID || '').replace(/[^0-9]/g, ''), String(process.env.UE_CATALOG_SOURCE_SHA || '').replace(/[^a-f0-9]/g, ''), String(out.observedAt || ''), String(out.snapshot || ''), PLANE, clearSha256].join('|')
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
          cipher.setAAD(Buffer.from(aad, 'utf8'))
          const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
          out.sealed = { scheme: SEAL_SCHEME, recipientKeyId: digestOf(recipient.export({ format: 'der', type: 'spki' }).toString('base64')).slice(0, 16),
            ephemeralPublicKey: ephemeral.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), salt: salt.toString('base64'), iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'), aad, plaintextSha256: crypto.createHash('sha256').update(plain).digest('hex'), plaintextBytes: plain.length, ciphertext: ciphertext.toString('base64') }
        } catch (error) {
          out.blocker = out.blocker || 'SEALING_FAILED'
        }
      } else if (hasValues) out.blocker = out.blocker || 'SEALING_FAILED'
      // Never emit a privileged value in the clear, whatever happened above.
      sensitive.counts.length = 0
      sensitive.ledgers.length = 0
      sensitive.modificationCounters.length = 0
      sensitive.settledCounters.length = 0
    }
    const body = JSON.stringify(out)
    const digest = crypto.createHash('sha256').update(body).digest('hex')
    if (process.env.UE_CATALOG_TRANSPORT === 'private-job') {
      // v2 frame: exact UTF-8 bytes, base64 per line, one nonce per session. The
      // controller accepts only lines bound to this job, execution, container and image.
      const bytes = Buffer.from(body, 'utf8')
      const sha = crypto.createHash('sha256').update(bytes).digest('hex')
      const nonce = crypto.randomBytes(16).toString('hex')
      const run = String(process.env.UE_CATALOG_RUN_ID || '').replace(/[^0-9]/g, '')
      const source = String(process.env.UE_CATALOG_SOURCE_SHA || '').replace(/[^a-f0-9]/g, '')
      if (bytes.length > MAX_BYTES) {
        process.stdout.write(FRAME + ' OVERFLOW ' + nonce + ' bytes=' + bytes.length + ' sha256=' + sha + '\\n')
      } else {
        const count = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES))
        process.stdout.write(FRAME + ' BEGIN ' + nonce + ' schema=' + SCHEMA + ' run=' + run + ' source=' + source + ' bytes=' + bytes.length + ' sha256=' + sha + ' chunks=' + count + ' chunkBytes=' + CHUNK_BYTES + '\\n')
        for (let index = 0; index < count; index += 1) {
          process.stdout.write(FRAME + ' CHUNK ' + nonce + ' ' + (index + 1) + '/' + count + ' ' + bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES).toString('base64') + '\\n')
        }
        process.stdout.write(FRAME + ' END ' + nonce + ' sha256=' + sha + '\\n')
      }
    } else {
      process.stdout.write(BEGIN + '\\n' + body + '\\n' + END + '\\n')
      process.stdout.write('UE_CATALOG_SHA256 ' + digest + '\\n')
    }
  }
}
// Nothing is printed on an unexpected failure: no stack, no message, no value.
main().catch(() => { process.exitCode = 70 })
`
}

export const CATALOG_CONTRACT = {
  schema: CATALOG_SCHEMA,
  categories: [
    { id: 'database_identity', queries: [{ id: 'identity', accept: ['OBSERVED'] }] },
    { id: 'migration_discovery', queries: [{ id: 'migration_relations', accept: ['OBSERVED'] }] },
    { id: 'migration_history', queries: [
      { id: 'migration_columns', accept: ['OBSERVED'], covers: 'migration_relations' },
      { id: 'drizzle_rows', accept: ['OBSERVED', 'ABSENT_VERIFIED'], absence: 'discovery' },
    ] },
    { id: 'roles_and_memberships', queries: [
      { id: 'roles', accept: ['OBSERVED'] },
      { id: 'memberships', accept: ['OBSERVED'] },
    ] },
    { id: 'relation_ownership_acl', queries: [{ id: 'relations', accept: ['OBSERVED'] }] },
    { id: 'rls_configuration', queries: [{ id: 'rls', accept: ['OBSERVED'] }] },
    { id: 'rls_policies', queries: [{ id: 'policies', accept: ['OBSERVED'] }] },
    { id: 'function_topology', queries: [{ id: 'function', accept: ['OBSERVED', 'ABSENT_VERIFIED'], absence: 'zero-rows' }] },
    { id: 'security_definer', queries: [{ id: 'security_definer', accept: ['OBSERVED'] }] },
    { id: 'event_triggers', queries: [{ id: 'event_trigger', accept: ['OBSERVED', 'ABSENT_VERIFIED'], absence: 'zero-rows' }] },
    { id: 'audit_permissions', queries: [{ id: 'audit', accept: ['OBSERVED', 'ABSENT_VERIFIED'], absence: 'zero-rows' }] },
    { id: 'audit_grants', queries: [{ id: 'audit_grants', accept: ['OBSERVED', 'ABSENT_VERIFIED'], absence: 'parent-audit' }] },
    { id: 'sequences', queries: [{ id: 'sequences', accept: ['OBSERVED'] }] },
    { id: 'business_tables', queries: [{ id: 'tables', accept: ['OBSERVED'] }] },
    { id: 'preservation_counts', counts: true },
  ],
}

// Which plane may supply each category. Posture is what the application's runtime role
// sees and can do. Migration history and preservation totals need global visibility,
// so they come only from the privileged plane; a role-visible count is never a total.
export const PLANE_RESPONSIBILITY = {
  runtime: ['database_identity', 'migration_discovery', 'roles_and_memberships', 'relation_ownership_acl', 'rls_configuration', 'rls_policies', 'function_topology', 'security_definer', 'event_triggers', 'audit_permissions', 'audit_grants', 'sequences', 'business_tables'],
  privileged: ['database_identity', 'migration_discovery', 'migration_history', 'business_tables', 'preservation_counts'],
}
const SHARED_CATEGORIES = new Set(['database_identity', 'migration_discovery', 'business_tables'])

function findQuery(catalog, id) {
  return (catalog?.queries ?? []).find((item) => item?.id === id) ?? null
}

function timeoutText(value) {
  return /statement timeout|canceling statement/i.test(String(value ?? ''))
}

function discoveryHasDrizzle(catalog) {
  const relations = findQuery(catalog, 'migration_relations')
  if (!relations || relations.error || !Array.isArray(relations.rows)) return null
  return relations.rows.some((row) => row.schema === 'drizzle' && row.name === '__drizzle_migrations')
}

export function classifyCatalogQuery(spec, query, catalog) {
  if (!query) return 'NOT_ATTEMPTED'
  if (query.classification === 'TIMED_OUT' || timeoutText(query.error)) return 'TIMED_OUT'
  if (query.error || query.classification === 'UNREADABLE') return 'UNREADABLE'
  if (query.classification === 'PRIVILEGE_DENIED') return 'PRIVILEGE_DENIED'
  if (query.rowsSealed === true && !Array.isArray(query.rows)) return 'SEALED'
  if (query.classification === 'NOT_ATTEMPTED') {
    if (query.reason === 'RELATION_NOT_IN_DISCOVERY' && spec.absence === 'discovery' && discoveryHasDrizzle(catalog) === false) return 'ABSENT_VERIFIED'
    if (query.reason === 'PARENT_ABSENT' && spec.absence === 'parent-audit') {
      const audit = classifyCatalogQuery({ absence: 'zero-rows' }, findQuery(catalog, 'audit'), catalog)
      if (audit === 'ABSENT_VERIFIED') return 'ABSENT_VERIFIED'
    }
    return 'NOT_ATTEMPTED'
  }
  if (!Array.isArray(query.rows)) return 'UNREADABLE'
  if (query.rows.length === 0 && spec.absence === 'zero-rows') return 'ABSENT_VERIFIED'
  if (spec.covers === 'migration_relations' && !migrationColumnsCover(query, catalog)) return 'INCONSISTENT'
  return 'OBSERVED'
}

// Column discovery is only evidence if every discovered migration relation has
// columns in it. An empty result next to a discovered ledger is hidden metadata,
// not absence (run 45940281038: information_schema returned nothing to the runtime role).
function migrationColumnsCover(query, catalog) {
  const relations = findQuery(catalog, 'migration_relations')
  if (!relations || relations.error || !Array.isArray(relations.rows)) return false
  return relations.rows.every((relation) => query.rows.some((column) => column.table_schema === relation.schema && column.table_name === relation.name))
}

function planeOf(catalog) {
  return catalog?.plane === 'privileged' ? 'privileged' : 'runtime'
}

// Recompute the count scope from the session's own privilege matrix instead of trusting
// the operator's label: GLOBAL only when SELECT is held and row security cannot filter.
export function matrixScope(catalog, schema, name) {
  const matrix = findQuery(catalog, 'privilege_matrix')
  if (!matrix || matrix.error || !Array.isArray(matrix.rows)) return undefined
  const entry = matrix.rows.find((row) => row.schema === schema && row.name === name)
  if (!entry || entry.schema_usage !== true || entry.can_select !== true) return null
  // PostgreSQL's own row_security_active() for that session decides; a session that lacks
  // the attribute that would explain it (superuser excluded) is inconsistent, not global.
  if (entry.rls_active !== false) return 'ROLE_VISIBLE'
  const bypass = catalog?.privilege?.rolbypassrls === true
  const explained = entry.rls !== true || bypass || (entry.acts_as_owner === true && entry.force !== true)
  return explained ? 'GLOBAL' : 'SCOPE_INCONSISTENT'
}

export function classifyCount(count, catalog) {
  if (!count) return 'NOT_ATTEMPTED'
  if (count.classification === 'PRIVILEGE_DENIED') return 'PRIVILEGE_DENIED'
  if (count.classification === 'NOT_ATTEMPTED') return 'NOT_ATTEMPTED'
  if (count.classification === 'TIMED_OUT' || timeoutText(count.error)) return 'TIMED_OUT'
  if (count.error || count.classification !== 'OBSERVED') return 'UNREADABLE'
  // Records without a proven global scope (every v2 record before this change, including
  // run 45940281038's 103 zeros) are what one role could see, not table totals.
  if (count.countScope !== 'GLOBAL' || count.globalTotal !== true) return 'ROLE_VISIBLE_ONLY'
  if (catalog && matrixScope(catalog, count.schema, count.name) !== 'GLOBAL') return 'SCOPE_UNPROVEN'
  if (count.sealed === true && (count.n === null || count.n === undefined)) return 'SEALED'
  if (!/^[0-9]+$/.test(String(count.n ?? ''))) return 'UNREADABLE'
  return 'GLOBAL_OBSERVED'
}

const PLANE_BLOCKERS = ['NO_IN_CONTAINER_PG_CLIENT', 'DATABASE_URL_ABSENT', 'DATABASE_URL_UNPARSEABLE', 'QUERY_FAILED', 'CONTINUATION_REJECTED', 'SCHEMA_DRIFT', 'EVIDENCE_RECIPIENT_MISSING', 'PRIVILEGED_CREDENTIAL_ABSENT', 'SEALING_FAILED', 'WRONG_TARGET', 'PRIVILEGE_REFUSED', 'STATS_UNTRACKED', 'STATS_UNREADABLE']

function identityDefect(catalog, contract) {
  const plane = planeOf(catalog)
  const identity = catalog.identity
  if (catalog.blocker === 'IDENTITY_REFUSED' || !identity || identity.transaction_read_only !== 'on' || identity.default_read_only !== 'on' || identity.database !== EXPECTED_DATABASE) return 'IDENTITY_REFUSED'
  if (plane === 'runtime') {
    // Posture describes the application's runtime role only when the session acted as it.
    if (identity.user !== RUNTIME_ROLE) return 'RUNTIME_ROLE_NOT_ASSUMED'
  } else {
    if (identity.user !== contract.privilegedLogin || identity.session_user !== contract.privilegedLogin) return 'PRIVILEGED_LOGIN_UNEXPECTED'
    if (identity.isolation !== 'repeatable read') return 'SNAPSHOT_ISOLATION_ABSENT'
    if (catalog.privilege?.rolsuper !== false) return 'PRIVILEGE_REFUSED'
  }
  const identityRow = findQuery(catalog, 'identity')?.rows?.[0]
  if (identityRow && (identityRow.database !== identity.database || identityRow.transaction_read_only !== identity.transaction_read_only)) return 'IDENTITY_INCONSISTENT'
  return null
}

function evaluateCategory(category, catalog) {
  if (category.counts) {
    const tables = findQuery(catalog, 'tables')
    const rows = tables && !tables.error && Array.isArray(tables.rows) ? tables.rows : null
    if (!rows) return { id: category.id, classification: 'UNREADABLE', accepted: false, items: [] }
    const items = rows.map((table) => ({
      schema: table.schema,
      name: table.name,
      classification: classifyCount((catalog.counts ?? []).find((item) => item.schema === table.schema && item.name === table.name), catalog),
    }))
    const accepted = items.length > 0 && items.every((item) => item.classification === 'GLOBAL_OBSERVED')
    const tally = {}
    for (const item of items) tally[item.classification] = (tally[item.classification] ?? 0) + 1
    return { id: category.id, classification: accepted ? 'GLOBAL_OBSERVED' : 'PARTIAL', accepted, tally, items }
  }
  const queries = category.queries.map((spec) => {
    const classification = classifyCatalogQuery(spec, findQuery(catalog, spec.id), catalog)
    return { id: spec.id, classification, accepted: spec.accept.includes(classification) }
  })
  return { id: category.id, accepted: queries.every((item) => item.accepted), queries }
}

export function evaluateCatalogCompleteness(catalog, contract = CATALOG_CONTRACT) {
  const empty = { categories: [], legacyObservation: null, additionalProcedure: null, S2_02_PREIMAGE_COMPLETE: 'NO', S2_02_LEGACY_GATE: 'INDETERMINATE' }
  const refused = (reason) => ({ verdict: 'CATALOG_REFUSED', reason, ...empty })
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return { verdict: 'CATALOG_UNREADABLE', reason: 'CATALOG_OUTPUT_UNREADABLE', ...empty }
  }
  if (catalog.schema !== contract.schema) return refused('UNEXPECTED_SCHEMA_VERSION')
  if (catalog.plane !== undefined && !CATALOG_PLANES.includes(catalog.plane)) return refused('UNKNOWN_PLANE')
  if (PLANE_BLOCKERS.includes(catalog.blocker)) return refused(catalog.blocker)
  if (catalog.rolledBack !== true) return refused('ROLLBACK_FAILED')
  const defect = identityDefect(catalog, { privilegedLogin: PRIVILEGED_LOGIN, ...contract })
  if (defect) return refused(defect)
  const plane = planeOf(catalog)
  const responsible = new Set(PLANE_RESPONSIBILITY[plane])
  const categories = contract.categories.map((category) => responsible.has(category.id)
    ? { ...evaluateCategory(category, catalog), plane }
    : { id: category.id, plane: null, classification: 'NOT_IN_PLANE', accepted: false })
  const functionClass = categories.flatMap((category) => category.queries ?? []).find((item) => item.id === 'function')?.classification
  const legacyObservation = functionClass === 'ABSENT_VERIFIED' ? 'LEGACY_TRANSITION_REQUIRED' : null
  const counts = categories.find((category) => category.id === 'preservation_counts')
  const retry = counts?.items?.some((item) => item.classification === 'NOT_ATTEMPTED' || item.classification === 'TIMED_OUT')
  const additionalProcedure = plane === 'privileged' && retry
    ? 'Repeat a privileged continuation session on the same revision for the NOT_ATTEMPTED or TIMED_OUT tables only. Keep count(*) on ONLY the relation, the 15s statement timeout, and the 45s wall budget. Do not disable row security, export rows, or raise the budget to force a complete result.'
    : null
  const inPlane = categories.filter((category) => responsible.has(category.id))
  const planeAccepted = inPlane.every((category) => category.accepted)
  // Captured under seal: every in-plane observation is present, some only as ciphertext.
  // It is opened and reconciled offline by the founder; it is never accepted unopened.
  const capturedSealed = !planeAccepted && inPlane.every((category) => category.accepted
    || ((category.queries ?? []).every((item) => item.accepted || item.classification === 'SEALED')
      && (category.items ?? []).every((item) => item.classification === 'GLOBAL_OBSERVED' || item.classification === 'SEALED')
      && (!category.items || category.items.length > 0)))
  const complete = categories.every((category) => category.accepted)
  return {
    verdict: complete ? 'CATALOG_COMPLETE' : 'CATALOG_PARTIAL',
    reason: complete ? null : planeAccepted ? 'OTHER_PLANE_REQUIRED' : 'REQUIRED_EVIDENCE_INCOMPLETE',
    plane,
    planeVerdict: planeAccepted ? 'PLANE_ACCEPTED' : capturedSealed ? 'PLANE_CAPTURED_SEALED' : 'PLANE_INCOMPLETE',
    categories,
    legacyObservation,
    additionalProcedure,
    S2_02_PREIMAGE_COMPLETE: 'NO',
    S2_02_LEGACY_GATE: 'INDETERMINATE',
  }
}

export const CONTINUATION_SCHEMA = 'ue-v2-staging-catalog-continuation/v1'
export const CONTINUATION_TTL_MS = 24 * 60 * 60 * 1000

export function inventoryDigest(tables) {
  const names = [...tables].map((table) => `${table.schema}.${table.name}`).sort()
  return createHash('sha256').update(names.join('\n')).digest('hex')
}

export function buildContinuationToken(catalog, binding, now = Date.now()) {
  const tables = (catalog?.queries ?? []).find((item) => item.id === 'tables')
  const rows = Array.isArray(tables?.rows) ? tables.rows : []
  const counts = Array.isArray(catalog?.counts) ? catalog.counts : []
  const completed = counts.filter((item) => item.classification === 'OBSERVED').map((item) => ({ schema: item.schema, name: item.name }))
  const remaining = counts.filter((item) => item.classification === 'NOT_ATTEMPTED').map((item) => ({ schema: item.schema, name: item.name }))
  if (!remaining.length) return null
  return {
    schema: CONTINUATION_SCHEMA,
    database: EXPECTED_DATABASE,
    revision: binding.revision,
    image: binding.image,
    inventoryDigest: inventoryDigest(rows),
    completed,
    remaining,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CONTINUATION_TTL_MS).toISOString(),
    baselineSessionId: binding.sessionId,
    baselineObservedAt: catalog.observedAt ?? null,
    plane: planeOf(catalog),
    ...(binding.source ? { source: binding.source } : {}),
  }
}

export function continuationDefect(token, binding, now = Date.now()) {
  if (!token || token.schema !== CONTINUATION_SCHEMA || token.database !== EXPECTED_DATABASE) return 'CONTINUATION_REJECTED'
  if (token.revision !== binding.revision || token.image !== binding.image) return 'REVISION_BINDING_CHANGED'
  // Sessions from a different operator source are different programmes; they are not merged.
  if (binding.source !== undefined && token.source !== binding.source) return 'CONTINUATION_SOURCE_CHANGED'
  if (!Number.isFinite(Date.parse(token.expiresAt)) || Date.parse(token.expiresAt) <= now) return 'CONTINUATION_EXPIRED'
  if (!/^[a-f0-9]{64}$/.test(token.inventoryDigest ?? '')) return 'CONTINUATION_REJECTED'
  const names = [...(token.completed ?? []), ...(token.remaining ?? [])]
  const seen = new Set()
  for (const item of names) {
    const key = `${item.schema}.${item.name}`
    if (seen.has(key)) return 'CONTINUATION_OVERLAP'
    seen.add(key)
  }
  return null
}

function sha256Hex(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
}

function structureDigest(catalog) {
  const row = findQuery(catalog, 'structure')?.rows?.[0]
  return row && typeof row.digest === 'string' ? `${row.columns}:${row.digest}` : null
}

function relationDigest(catalog) {
  const row = findQuery(catalog, 'relation_metadata')?.rows?.[0]
  return row && typeof row.digest === 'string' ? `${row.relations}:${row.digest}:${row.policy_digest}` : null
}

function migrationDigest(catalog) {
  const relations = findQuery(catalog, 'migration_relations')
  const columns = findQuery(catalog, 'migration_columns')
  const ledger = findQuery(catalog, 'drizzle_rows')
  return sha256Hex({
    relations: Array.isArray(relations?.rows) ? relations.rows.map((row) => `${row.schema}.${row.name}`) : null,
    columns: Array.isArray(columns?.rows) ? columns.rows.map((row) => `${row.table_schema}.${row.table_name}.${row.column_name}:${row.data_type}`) : null,
    ledger: ledger?.ledgerDigest ?? (Array.isArray(ledger?.rows) ? sha256Hex(ledger.rows) : ledger?.classification ?? null),
  })
}

// Sessions are merged only when nothing observable moved between them. Each session is
// internally consistent; the merge is never described as one atomic snapshot unless
// it is literally one session.
export function reconcileCatalogSessions(sessions, binding, options = {}) {
  const settleMs = options.statsSettleMs ?? STATS_SETTLE_MS
  if (!Array.isArray(sessions) || sessions.length === 0) return { verdict: 'CATALOG_UNREADABLE', reason: 'EVIDENCE_MISSING' }
  const [first, ...rest] = sessions
  const times = sessions.map((session) => session.observedAt)
  if (times.some((value) => typeof value !== 'string') || new Set(times).size !== times.length) {
    return { verdict: 'CATALOG_REFUSED', reason: 'CONTINUATION_TIMESTAMPS' }
  }
  const plane = planeOf(first.catalog)
  const merged = structuredClone(first.catalog)
  const baselineCounts = new Map((merged.counts ?? []).map((item) => [`${item.schema}.${item.name}`, item]))
  const baseStructure = structureDigest(first.catalog)
  const baseRelations = relationDigest(first.catalog)
  const baseMigration = migrationDigest(first.catalog)
  if (rest.some((session) => planeOf(session.catalog) !== plane)) return { verdict: 'CATALOG_REFUSED', reason: 'CONTINUATION_PLANE_CHANGED' }
  if (plane === 'privileged' && sessions.length > 1) {
    // Every session's opening and settled counters must equal the first session's opening
    // counters, and each closing read must come after the statistics flush interval.
    for (const session of sessions) {
      const catalog = session.catalog ?? {}
      if (!first.catalog.modificationDigest || catalog.modificationDigest !== first.catalog.modificationDigest || catalog.settledModificationDigest !== first.catalog.modificationDigest) {
        return { verdict: 'CATALOG_REFUSED', reason: 'DATA_DRIFT_BETWEEN_SESSIONS' }
      }
      if (!(Number(catalog.statsSettledMs) >= settleMs)) return { verdict: 'CATALOG_REFUSED', reason: 'STATS_SETTLE_UNPROVEN' }
    }
  }
  for (const session of rest) {
    if (planeOf(session.catalog) !== plane) return { verdict: 'CATALOG_REFUSED', reason: 'CONTINUATION_PLANE_CHANGED' }
    const defect = continuationDefect(session.token, binding, session.now ?? Date.parse(session.observedAt))
    if (defect) return { verdict: 'CATALOG_REFUSED', reason: defect }
    if ((session.token.plane ?? 'runtime') !== plane) return { verdict: 'CATALOG_REFUSED', reason: 'CONTINUATION_PLANE_CHANGED' }
    const discovered = (session.catalog?.queries ?? []).find((item) => item.id === 'tables')
    if (!discovered || inventoryDigest(discovered.rows ?? []) !== session.token.inventoryDigest) {
      return { verdict: 'CATALOG_REFUSED', reason: 'SCHEMA_DRIFT' }
    }
    if (!baseStructure || structureDigest(session.catalog) !== baseStructure) return { verdict: 'CATALOG_REFUSED', reason: 'STRUCTURE_DRIFT' }
    if (!baseRelations || relationDigest(session.catalog) !== baseRelations) return { verdict: 'CATALOG_REFUSED', reason: 'RELATION_METADATA_DRIFT' }
    if (plane === 'privileged' && migrationDigest(session.catalog) !== baseMigration) return { verdict: 'CATALOG_REFUSED', reason: 'MIGRATION_DRIFT' }
    for (const count of session.catalog?.counts ?? []) {
      const key = `${count.schema}.${count.name}`
      const prior = baselineCounts.get(key)
      if (prior && prior.classification === 'OBSERVED') {
        return { verdict: 'CATALOG_REFUSED', reason: String(prior.n) === String(count.n) ? 'CONTINUATION_OVERLAP' : 'CONTINUATION_CONTRADICTION' }
      }
      baselineCounts.set(key, count)
    }
  }
  merged.counts = [...baselineCounts.values()]
  merged.observedAt = first.observedAt
  const consistency = {
    plane,
    sessions: sessions.length,
    sessionWindow: { first: times[0], last: times[times.length - 1] },
    snapshots: sessions.map((session) => session.catalog?.snapshot ?? null),
    atomicSnapshot: plane === 'privileged' && sessions.length === 1,
    basis: sessions.length === 1
      ? (plane === 'privileged' ? 'ONE_REPEATABLE_READ_TRANSACTION' : 'ONE_READ_ONLY_SESSION')
      : (plane === 'privileged' ? 'MULTI_SESSION_NO_CHANGE_DETECTED' : 'MULTI_SESSION_STRUCTURE_UNCHANGED'),
    statsSettleMs: plane === 'privileged' ? sessions.map((session) => session.catalog?.statsSettledMs ?? null) : null,
    caveat: sessions.length === 1 ? null : plane === 'privileged' ? CONSISTENCY_CAVEAT : RUNTIME_CONSISTENCY_CAVEAT,
  }
  merged.consistency = consistency
  const evaluation = evaluateCatalogCompleteness(merged)
  return { verdict: evaluation.verdict, reason: evaluation.reason, evaluation, catalog: merged, sessions: times, consistency }
}

export const CONSISTENCY_CAVEAT = 'Each session counted inside one REPEATABLE READ snapshot. Across sessions, the table inventory, column structure, relation and policy metadata, migration ledger, and per-table cumulative statistics (relid, n_tup_ins, n_tup_upd, n_tup_del, relfilenode) read at the start of every session and again after the statistics flush interval were identical. That detects any insert, update, delete, TRUNCATE, rewrite or table replacement whose statistics were recorded; it does not detect a statistics reset followed by replay to identical values, or statistics lost without a reset. It is a bounded multi-session inventory, not one atomic snapshot.'

// The runtime plane reads neither row-change statistics nor the migration ledger, and counts in a
// plain READ ONLY transaction; its multi-session caveat claims only what reconciliation compared.
export const RUNTIME_CONSISTENCY_CAVEAT = 'Each session counted inside one READ ONLY transaction as the runtime role. Across sessions, the table inventory, column structure, and relation and policy metadata were identical. This plane reads neither row-change statistics nor the migration ledger, so data changes between sessions are not detected here; its counts are role-visible posture, never totals. It is a bounded multi-session inventory, not one atomic snapshot.'

export function recipientKeyId(publicKey) {
  const key = publicKey?.type === 'public' && typeof publicKey.export === 'function' ? publicKey : createPublicKey(publicKey)
  return sha256Hex(key.export({ format: 'der', type: 'spki' }).toString('base64')).slice(0, 16)
}

// The founder generates this pair offline. Only the public half goes to GitHub, as an
// environment variable; the private half never leaves the founder's machine.
export function generateRecipientKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    keyId: recipientKeyId(publicKey),
  }
}

export function sealForRecipient(plain, recipientPublicKey, aad) {
  const recipient = createPublicKey({ key: Buffer.from(recipientPublicKey, 'base64'), format: 'der', type: 'spki' })
  const ephemeral = generateKeyPairSync('x25519')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = Buffer.from(hkdfSync('sha256', diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient }), salt, Buffer.from(SEAL_INFO), 32))
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const bytes = Buffer.from(plain, 'utf8')
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()])
  return { scheme: SEAL_SCHEME, recipientKeyId: recipientKeyId(recipient), ephemeralPublicKey: ephemeral.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'), salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), aad, plaintextSha256: sha256Hex(bytes.toString('utf8')), plaintextBytes: bytes.length, ciphertext: ciphertext.toString('base64') }
}

export function unseal(sealed, privateKeyPem) {
  if (!sealed || sealed.scheme !== SEAL_SCHEME) throw new Error('SEALED_EVIDENCE_ABSENT')
  const privateKey = createPrivateKey(privateKeyPem)
  if (privateKey.asymmetricKeyType !== 'x25519') throw new Error('SEALED_FOR_ANOTHER_RECIPIENT')
  if (recipientKeyId(createPublicKey(privateKey)) !== sealed.recipientKeyId) throw new Error('SEALED_FOR_ANOTHER_RECIPIENT')
  // Exact lengths: Node accepts GCM tags down to 4 bytes, which would weaken authentication.
  const decode = (value, bytes) => {
    const text = String(value ?? '')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('SEALED_EVIDENCE_TAMPERED')
    const buffer = Buffer.from(text, 'base64')
    if (bytes !== undefined && buffer.length !== bytes) throw new Error('SEALED_EVIDENCE_TAMPERED')
    return buffer
  }
  const iv = decode(sealed.iv, 12)
  const tag = decode(sealed.tag, 16)
  const salt = decode(sealed.salt, 16)
  const ciphertext = decode(sealed.ciphertext)
  if (ciphertext.length !== sealed.plaintextBytes) throw new Error('SEALED_EVIDENCE_TAMPERED')
  let ephemeral
  try { ephemeral = createPublicKey({ key: decode(sealed.ephemeralPublicKey), format: 'der', type: 'spki' }) } catch { throw new Error('SEALED_EVIDENCE_TAMPERED') }
  if (ephemeral.asymmetricKeyType !== 'x25519') throw new Error('SEALED_EVIDENCE_TAMPERED')
  let plain
  try {
    const key = Buffer.from(hkdfSync('sha256', diffieHellman({ privateKey, publicKey: ephemeral }), salt, Buffer.from(SEAL_INFO), 32))
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
    decipher.setAAD(Buffer.from(String(sealed.aad), 'utf8'))
    decipher.setAuthTag(tag)
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('SEALED_EVIDENCE_TAMPERED')
  }
  if (sha256Hex(plain) !== sealed.plaintextSha256) throw new Error('SEALED_EVIDENCE_TAMPERED')
  return plain
}

// Opens a privileged session locally with the founder's key. Every sealed value must
// match the clear summary exactly: same tables, same ledger digest, same counter digest.
export function openSealedCatalog(catalog, privateKeyPem) {
  if (planeOf(catalog) !== 'privileged') throw new Error('NOT_A_PRIVILEGED_SESSION')
  const sealed = catalog.sealed
  const parts = String(sealed?.aad ?? '').split('|')
  const clear = { ...catalog }
  delete clear.sealed
  if (parts.length !== 7 || parts[0] !== SEAL_INFO || parts[3] !== String(catalog.observedAt ?? '') || parts[4] !== String(catalog.snapshot ?? '') || parts[5] !== 'privileged') throw new Error('SEALED_EVIDENCE_UNBOUND')
  // The clear summary is exactly the one the container sealed with: no mix-and-match.
  if (parts[6] !== sha256Hex(JSON.stringify(clear))) throw new Error('SEALED_EVIDENCE_UNBOUND')
  const values = JSON.parse(unseal(sealed, privateKeyPem))
  const opened = structuredClone(catalog)
  const sealedCounts = (opened.counts ?? []).filter((item) => item.sealed === true)
  const plainCounts = new Map()
  for (const item of values.counts ?? []) {
    const key = `${item.schema}.${item.name}`
    if (plainCounts.has(key) || !/^[0-9]+$/.test(String(item.n))) throw new Error('SEALED_COUNTS_INCONSISTENT')
    plainCounts.set(key, String(item.n))
  }
  if (plainCounts.size !== sealedCounts.length) throw new Error('SEALED_COUNTS_INCONSISTENT')
  for (const item of sealedCounts) {
    const value = plainCounts.get(`${item.schema}.${item.name}`)
    if (value === undefined) throw new Error('SEALED_COUNTS_INCONSISTENT')
    item.n = value
  }
  const ledgerQuery = findQuery(opened, 'drizzle_rows')
  const ledgers = values.ledgers ?? []
  if (ledgerQuery?.rowsSealed === true) {
    const ledger = ledgers.find((item) => item.relation === 'drizzle.__drizzle_migrations')
    if (!ledger || !Array.isArray(ledger.rows) || ledger.rows.length !== ledgerQuery.rowCount || sha256Hex(ledger.rows) !== ledgerQuery.ledgerDigest) throw new Error('SEALED_LEDGER_INCONSISTENT')
    ledgerQuery.rows = ledger.rows
  } else if (ledgers.length) throw new Error('SEALED_LEDGER_INCONSISTENT')
  const countersDigest = (rows) => sha256Hex(rows.map((item) => [item.oid, item.schema, item.name, item.ins, item.upd, item.del, item.filenode].join(':')).join('\n'))
  for (const [field, digestField] of [['modificationCounters', 'modificationDigest'], ['settledCounters', 'settledModificationDigest']]) {
    const rows = Array.isArray(values[field]) ? values[field] : []
    if ((opened[digestField] !== undefined || rows.length) && countersDigest(rows) !== opened[digestField]) throw new Error('SEALED_COUNTERS_INCONSISTENT')
  }
  opened.sealed = { ...sealed, ciphertext: undefined, opened: true }
  return { catalog: opened, run: parts[1], source: parts[2] }
}

// The complete preimage needs both planes: runtime posture and privileged totals. They are
// separate sessions on separate logins and are never presented as one snapshot.
export function reconcilePlanes({ runtime, privileged }, contract = CATALOG_CONTRACT) {
  const refused = (reason) => ({ verdict: 'CATALOG_REFUSED', reason, categories: [], S2_02_PREIMAGE_COMPLETE: 'NO', S2_02_LEGACY_GATE: 'INDETERMINATE' })
  if (!runtime?.catalog || !privileged?.catalog) return refused('PLANE_EVIDENCE_MISSING')
  if (planeOf(runtime.catalog) !== 'runtime' || planeOf(privileged.catalog) !== 'privileged') return refused('PLANE_MISMATCH')
  const a = evaluateCatalogCompleteness(runtime.catalog, contract)
  const b = evaluateCatalogCompleteness(privileged.catalog, contract)
  if (!['CATALOG_COMPLETE', 'CATALOG_PARTIAL'].includes(a.verdict)) return refused(`RUNTIME_${a.reason}`)
  if (!['CATALOG_COMPLETE', 'CATALOG_PARTIAL'].includes(b.verdict)) return refused(`PRIVILEGED_${b.reason}`)
  if (privileged.catalog.sealed && privileged.catalog.sealed.opened !== true) return refused('PRIVILEGED_EVIDENCE_SEALED')
  const runtimeTables = findQuery(runtime.catalog, 'tables')?.rows ?? []
  const privilegedTables = findQuery(privileged.catalog, 'tables')?.rows ?? []
  if (inventoryDigest(runtimeTables) !== inventoryDigest(privilegedTables)) return refused('PLANE_INVENTORY_DRIFT')
  if (structureDigest(runtime.catalog) !== structureDigest(privileged.catalog) || !structureDigest(runtime.catalog)) return refused('PLANE_STRUCTURE_DRIFT')
  if (relationDigest(runtime.catalog) !== relationDigest(privileged.catalog) || !relationDigest(runtime.catalog)) return refused('PLANE_RELATION_METADATA_DRIFT')
  const relations = (catalog) => JSON.stringify((findQuery(catalog, 'migration_relations')?.rows ?? []).map((row) => `${row.schema}.${row.name}`))
  if (relations(runtime.catalog) !== relations(privileged.catalog)) return refused('PLANE_MIGRATION_DISCOVERY_DRIFT')
  const pick = (evaluation, id) => evaluation.categories.find((category) => category.id === id)
  const categories = contract.categories.map((category) => {
    if (SHARED_CATEGORIES.has(category.id)) {
      const fromA = pick(a, category.id)
      const fromB = pick(b, category.id)
      return { id: category.id, source: 'both', accepted: Boolean(fromA?.accepted && fromB?.accepted), runtime: fromA, privileged: fromB }
    }
    const source = PLANE_RESPONSIBILITY.privileged.includes(category.id) ? 'privileged' : 'runtime'
    const chosen = pick(source === 'privileged' ? b : a, category.id)
    return { ...chosen, source, accepted: Boolean(chosen?.accepted) }
  })
  const complete = categories.every((category) => category.accepted)
  return {
    verdict: complete ? 'CATALOG_COMPLETE' : 'CATALOG_PARTIAL',
    reason: complete ? null : 'REQUIRED_EVIDENCE_INCOMPLETE',
    categories,
    consistency: {
      crossPlaneAtomic: false,
      runtime: runtime.consistency ?? runtime.catalog.consistency ?? null,
      privileged: privileged.consistency ?? privileged.catalog.consistency ?? null,
      note: 'Runtime posture and privileged totals are separate sessions on separate logins. Inventory, column structure and migration discovery matched across planes; the planes are not one snapshot.',
    },
    legacyObservation: a.legacyObservation,
    S2_02_PREIMAGE_COMPLETE: 'NO',
    S2_02_LEGACY_GATE: 'INDETERMINATE',
  }
}

export function parseCatalogStdout(text) {
  const redacted = redact(text)
  const start = redacted.lastIndexOf(MARK_BEGIN)
  const end = redacted.lastIndexOf(MARK_END)
  if (start < 0 || end < start) return { ok: false, verdict: 'CATALOG_UNREADABLE', blocker: 'EXEC_OUTPUT_WITHOUT_CATALOG_MARKER', transcript: redacted.slice(-4000) }
  let body
  try {
    body = JSON.parse(redacted.slice(start + MARK_BEGIN.length, end).trim())
  } catch {
    return { ok: false, verdict: 'CATALOG_UNREADABLE', blocker: 'CATALOG_OUTPUT_UNREADABLE', transcript: redacted.slice(-4000) }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, verdict: 'CATALOG_UNREADABLE', blocker: 'CATALOG_OUTPUT_UNREADABLE', transcript: redacted.slice(-4000) }
  }
  const evaluation = evaluateCatalogCompleteness(body)
  body.evaluation = evaluation
  const ok = evaluation.verdict === 'CATALOG_COMPLETE'
  return { ok, verdict: evaluation.verdict, blocker: ok ? null : evaluation.verdict, body }
}

// Same revision properties inventory run 45766945607 returned from `revision list`:
// healthState, trafficWeight, and containers[].image. `revision show` is that
// one resource. A missing field is REVISION_FIELDS_ABSENT, not a looser match.
export const REVISION_QUERY = '{name:name,healthState:properties.healthState,trafficWeight:properties.trafficWeight,runningState:properties.runningState,containers:properties.template.containers[].{name:name,image:image}}'

// The revision's control-plane health is not a proof that a particular replica is
// reachable through ACA's WebSocket console. Resolve one running target explicitly.
export const REPLICA_QUERY = '[].{name:name,runningState:properties.runningState,containers:properties.containers[].name}'

export function selectReplica(replicas) {
  if (!Array.isArray(replicas) || replicas.length === 0) {
    return { defect: 'NO_REPLICA_OBSERVED', name: null, eligibleCount: 0 }
  }
  if (replicas.some((replica) =>
    !replica || typeof replica.name !== 'string' || typeof replica.runningState !== 'string'
    || !Array.isArray(replica.containers) || replica.containers.some((name) => typeof name !== 'string')
  )) {
    return { defect: 'REPLICA_FIELDS_ABSENT', name: null, eligibleCount: 0 }
  }
  const eligible = replicas.filter((replica) =>
    replica.name.startsWith(EXPECTED_REVISION + '-')
    && /^[a-z0-9-]+$/.test(replica.name)
    && replica.runningState === 'Running'
    && replica.containers.includes(CONTAINER_NAME)
  ).sort((a, b) => a.name.localeCompare(b.name))
  if (!eligible.length) return { defect: 'NO_ELIGIBLE_RUNNING_REPLICA', name: null, eligibleCount: 0 }
  return { defect: null, name: eligible[0].name, eligibleCount: eligible.length }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`
}

export function execInvocation(replicaName) {
  if (typeof replicaName !== 'string' || !replicaName.startsWith(EXPECTED_REVISION + '-') || !/^[a-z0-9-]+$/.test(replicaName)) {
    throw new Error('REPLICA_BINDING_REFUSED')
  }
  const program = containerSource()
  if (program.includes('eval(')) throw new Error('CONTAINER_PROGRAM_REFUSES_EVAL')
  const node = `node -e ${shellQuote(program)}`
  const args = [
    'containerapp', 'exec',
    '--resource-group', RESOURCE_GROUP,
    '--name', CONTAINER_APP,
    '--revision', EXPECTED_REVISION,
    '--replica', replicaName,
    '--container', CONTAINER_NAME,
    '--command', node,
  ]
  const quoted = args.map((arg) => `'${arg.replaceAll("'", `'"'"'`)}'`).join(' ')
  return {
    executable: 'timeout',
    args: ['90', 'script', '-q', '-e', '-c', `az ${quoted}`, '/dev/null'],
  }
}

export function liveAuthorization(env) {
  const defects = []
  if (env.UE_CATALOG_EXEC_LIVE !== '1') defects.push('LIVE_NOT_AUTHORIZED')
  if (env.GITHUB_REPOSITORY !== REPOSITORY) defects.push('WRONG_REPOSITORY')
  if (env.GITHUB_REF !== DEFAULT_REF) defects.push('NOT_DEFAULT_BRANCH')
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') defects.push('NOT_MANUAL_DISPATCH')
  return defects
}

function parseJson(text, label) {
  try { return JSON.parse(text) } catch { throw new Error(`${label}_UNREADABLE`) }
}

function revisionAccepted(revision) {
  const container = (revision?.containers ?? []).find((item) => item.name === CONTAINER_NAME)
  return revision?.name === EXPECTED_REVISION
    && revision?.trafficWeight === 100
    && revision?.healthState === 'Healthy'
    && container?.image === EXPECTED_IMAGE
}

export function revisionDefect(revision) {
  const container = (revision?.containers ?? []).find((item) => item.name === CONTAINER_NAME)
  const present = typeof revision?.name === 'string' && revision.name.length > 0
    && typeof revision?.healthState === 'string' && revision.healthState.length > 0
    && typeof revision?.trafficWeight === 'number' && Number.isFinite(revision.trafficWeight)
    && typeof container?.image === 'string' && container.image.length > 0
  if (!present) return 'REVISION_FIELDS_ABSENT'
  if (!revisionAccepted(revision)) return 'REVISION_BINDING_CHANGED'
  return null
}

export async function executeCatalog(env, spawn) {
  const arm = (args) => spawn('az', args)
  const defects = liveAuthorization(env)
  const report = {
    schema: 'ue-v2-staging-catalog-exec/v1',
    defects,
    subscriptionId: null,
    tenantId: null,
    caller: null,
    verdict: null,
    S2_02_PREIMAGE_COMPLETE: 'NO',
    S2_02_LEGACY_GATE: 'INDETERMINATE',
    execPermission: 'NOT_OBSERVED',
    revision: 'NOT_OBSERVED',
    replica: 'NOT_OBSERVED',
    execAttempted: false,
    catalog: null,
  }
  if (defects.length) return { exitCode: 1, report }

  const account = await arm(['account', 'show', '--query', '{subscriptionId:id,tenantId:tenantId}', '-o', 'json'])
  if (account.code !== 0) {
    report.defects.push('ACCOUNT_UNREAD')
    report.accountError = redact(account.stderr).slice(0, 500)
    return { exitCode: 1, report }
  }
  const accountBody = parseJson(account.stdout, 'ACCOUNT')
  report.subscriptionId = accountBody.subscriptionId
  report.tenantId = accountBody.tenantId
  if (accountBody.subscriptionId !== SUBSCRIPTION_ID || accountBody.tenantId !== TENANT_ID) {
    report.defects.push('WRONG_ACCOUNT')
    return { exitCode: 1, report }
  }

  const token = await arm(['account', 'get-access-token', '--query', 'accessToken', '-o', 'tsv'])
  if (token.code !== 0) {
    report.defects.push('CALLER_UNREAD')
    return { exitCode: 1, report }
  }
  report.caller = principalFromAccessToken(token.stdout.trim())
  if (report.caller.tid !== TENANT_ID) {
    report.defects.push('WRONG_CALLER_TENANT')
    return { exitCode: 1, report }
  }

  const assignments = await arm(['role', 'assignment', 'list', '--scope', GROUP_ID, '--include-inherited', '-o', 'json'])
  if (assignments.code !== 0) {
    report.defects.push('ROLE_ASSIGNMENTS_UNREAD')
    report.roleError = redact(assignments.stderr).slice(0, 500)
    return { exitCode: 1, report }
  }
  const mine = parseJson(assignments.stdout, 'ASSIGNMENTS').filter((item) => item.principalId === report.caller.oid)
  report.caller.assignmentCount = mine.length
  report.caller.roles = mine.map((item) => ({ role: item.roleDefinitionName, scope: item.scope }))
  const definitions = []
  for (const item of mine) {
    const definition = await arm(['role', 'definition', 'list', '--name', item.roleDefinitionName, '--scope', GROUP_ID, '-o', 'json'])
    if (definition.code !== 0) {
      report.defects.push('ROLE_DEFINITION_UNREAD')
      return { exitCode: 1, report }
    }
    const body = parseJson(definition.stdout, 'DEFINITION')
    definitions.push(...(Array.isArray(body) ? body : [body]))
  }
  const covered = definitions.some((definition) => roleCoversExec(definition))
  report.execPermission = covered ? 'EFFECTIVE_ALLOW_OBSERVED' : 'NOT_GRANTED'
  if (!covered) {
    report.defects.push('EXEC_ACTION_ABSENT')
    return { exitCode: 3, report }
  }

  const revision = await arm([
    'containerapp', 'revision', 'show',
    '--resource-group', RESOURCE_GROUP,
    '--name', CONTAINER_APP,
    '--revision', EXPECTED_REVISION,
    '--query', REVISION_QUERY,
    '-o', 'json',
  ])
  if (revision.code !== 0) {
    report.defects.push('REVISION_UNREAD')
    report.revisionError = redact(revision.stderr).slice(0, 500)
    return { exitCode: 4, report }
  }
  report.revision = parseJson(revision.stdout, 'REVISION')
  const bindingDefect = revisionDefect(report.revision)
  if (bindingDefect) {
    report.defects.push(bindingDefect)
    return { exitCode: 4, report }
  }

  // Resolve the actual running replica only after the revision, traffic and
  // immutable image binding have passed. A 404 may still be an ACA console
  // service failure; never infer SQL success from the absence of an error.
  const replicaRead = await arm([
    'containerapp', 'replica', 'list',
    '--resource-group', RESOURCE_GROUP,
    '--name', CONTAINER_APP,
    '--revision', EXPECTED_REVISION,
    '--query', REPLICA_QUERY,
    '-o', 'json',
  ])
  if (replicaRead.code !== 0) {
    report.defects.push('REPLICA_LIST_UNREADABLE')
    report.replicaError = redact(replicaRead.stderr).slice(0, 500)
    return { exitCode: 4, report }
  }
  let replicaList
  try { replicaList = parseJson(replicaRead.stdout, 'REPLICA_LIST') } catch {
    report.defects.push('REPLICA_LIST_UNREADABLE')
    return { exitCode: 4, report }
  }
  const selected = selectReplica(replicaList)
  report.replica = { selectedName: selected.name, eligibleCount: selected.eligibleCount }
  if (selected.defect) {
    report.defects.push(selected.defect)
    return { exitCode: 4, report }
  }

  report.execAttempted = true
  const invocation = execInvocation(selected.name)
  if (invocation.executable !== 'timeout') throw new Error('EXEC_WRAPPER_MUST_BE_TIMEOUT')
  const exec = await spawn(invocation.executable, invocation.args)
  report.execExitCode = exec.code
  if (exec.code === 124) {
    report.verdict = 'CATALOG_REFUSED'
    report.defects.push('EXEC_TIMED_OUT')
    return { exitCode: 5, report }
  }
  const parsed = parseCatalogStdout(`${exec.stdout}\n${exec.stderr}`)
  report.catalog = parsed.body ?? null
  report.verdict = parsed.verdict
  if (!parsed.ok) {
    if (/Handshake status 404 Not Found/i.test(`${exec.stdout}\n${exec.stderr}`)) report.defects.push('EXEC_WEBSOCKET_404')
    report.defects.push(parsed.verdict)
    if (parsed.blocker && parsed.blocker !== parsed.verdict) report.defects.push(parsed.blocker)
    if (parsed.transcript) report.transcriptTail = parsed.transcript
    return { exitCode: 5, report }
  }
  return { exitCode: 0, report }
}

export function writeReport(directory, report) {
  mkdirSync(directory, { recursive: true })
  const body = `${JSON.stringify(report, null, 2)}\n`
  const digest = createHash('sha256').update(body).digest('hex')
  writeFileSync(path.join(directory, 'catalog.json'), body)
  writeFileSync(path.join(directory, 'SHA256SUMS'), `${digest}  catalog.json\n`)
  return digest
}

export function launch(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8' })
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (invoked) {
  const outFlag = process.argv.indexOf('--out')
  const directory = outFlag >= 0 ? process.argv[outFlag + 1] : ''
  if (!directory) {
    console.error('CATALOG_OUTPUT_REQUIRED')
    process.exit(1)
  }
  const result = await executeCatalog(process.env, launch)
  const digest = writeReport(directory, result.report)
  const verdict = result.report.verdict ?? 'CATALOG_REFUSED'
  console.log(`catalog=${verdict} sha256=${digest} defects=${result.report.defects.join(',')} S2_02_PREIMAGE_COMPLETE=NO S2_02_LEGACY_GATE=INDETERMINATE`)
  process.exit(result.exitCode)
}
