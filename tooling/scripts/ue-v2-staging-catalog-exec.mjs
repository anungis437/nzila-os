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
import { createHash } from 'node:crypto'
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
export const COUNT_MAX_STATEMENTS = 250
export const SOURCE_TABLE_DECLARATIONS = 1224
export const EVIDENCE_CHUNK_CHARS = 2400
export const EVIDENCE_MAX_CHUNKS = 280
export const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_CHUNKS * EVIDENCE_CHUNK_CHARS
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
function failed(id, error) {
  const message = redact(error.message)
  const timedOut = /statement timeout|canceling statement/i.test(message)
  return { id, error: message, classification: timedOut ? 'TIMED_OUT' : 'UNREADABLE' }
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
async function main() {
  const out = { schema: SCHEMA, queries: [], counts: [], rolledBack: false }
  let client
  try {
    let pg
    try { pg = require('pg') } catch { pg = null }
    out.client = { module: 'pg', resolved: Boolean(pg), psql: false }
    if (!pg) { out.blocker = 'NO_IN_CONTAINER_PG_CLIENT'; return }
    if (!process.env.DATABASE_URL) { out.blocker = 'DATABASE_URL_ABSENT'; return }
    client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 15000, application_name: 'ue-s202-catalog' })
    await client.connect()
    await client.query('BEGIN READ ONLY')
    await client.query("SET LOCAL statement_timeout = '15s'")
    await client.query("SET LOCAL lock_timeout = '2s'")
    const identity = await query(client, 'identity', "SELECT version() AS version, current_database() AS database, current_user AS \\"user\\", current_setting('transaction_read_only') AS transaction_read_only")
    out.queries.push(identity)
    const row = identity.rows && identity.rows[0]
    out.identity = row ?? null
    if (!row || row.transaction_read_only !== 'on' || row.database !== 'ue_v2_staging') { out.blocker = 'IDENTITY_REFUSED'; return }
    out.observedAt = new Date().toISOString()
    out.readOnlyCredential = false
    out.transport = process.env.UE_CATALOG_TRANSPORT || 'not-recorded'
    let continuation = null
    if (process.env.UE_CATALOG_CONTINUATION) {
      try { continuation = JSON.parse(process.env.UE_CATALOG_CONTINUATION) } catch { out.blocker = 'CONTINUATION_REJECTED'; return }
      if (!continuation || continuation.schema !== 'ue-v2-staging-catalog-continuation/v1' || continuation.database !== 'ue_v2_staging' || !(continuation.expiresAt > out.observedAt)) { out.blocker = 'CONTINUATION_REJECTED'; return }
      out.sessionKind = 'continuation'
      out.baselineSessionId = continuation.baselineSessionId
    } else out.sessionKind = 'baseline'
    const privilege = await query(client, 'privilege', 'SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user')
    out.queries.push(privilege)
    const privilegeRow = privilege.rows && privilege.rows[0]
    out.privilege = privilegeRow ? { user: privilegeRow.rolname, rolsuper: privilegeRow.rolsuper === true, rolbypassrls: privilegeRow.rolbypassrls === true, classification: (privilegeRow.rolsuper === true || privilegeRow.rolbypassrls === true || privilegeRow.rolcreatedb === true || privilegeRow.rolcreaterole === true) ? 'ELEVATED' : 'LIMITED_RUNTIME', readOnlyCredential: false } : { classification: 'UNREADABLE', readOnlyCredential: false }
    const statements = continuation ? [] : [
      ['migration_relations', "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relname IN ('__drizzle_migrations','drizzle_migrations','schema_migrations','django_migrations') AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['migration_columns', "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('__drizzle_migrations','drizzle_migrations','schema_migrations','django_migrations') AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2, 3"],
      ['roles', "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname"],
      ['memberships', "SELECT r.rolname AS role, m.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member ORDER BY 1, 2"],
      ['relations', "SELECT n.nspname AS schema, c.relname AS name, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','S') AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['rls', "SELECT n.nspname AS schema, c.relname AS name, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['policies', "SELECT n.nspname AS schema, c.relname AS name, pol.polname, pol.polcmd, pol.polpermissive, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace ORDER BY 1, 2, 3"],
      ['function', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'user_management' AND p.proname = 'auth_business_org_authorized'"],
      ['security_definer', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['event_trigger', "SELECT e.evtname, e.evtenabled, e.evtevent, n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid JOIN pg_namespace n ON n.oid = p.pronamespace WHERE e.evtname = 'ue_guard_deadline_reassignment_convergence_policy'"],
      ['audit', "SELECT to_regclass('audit_security.audit_logs') AS rel, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl, c.relrowsecurity, c.relforcerowsecurity, has_table_privilege(current_user, c.oid, 'SELECT') AS current_select, has_table_privilege(current_user, c.oid, 'INSERT') AS current_insert, has_table_privilege(current_user, c.oid, 'UPDATE') AS current_update, has_table_privilege(current_user, c.oid, 'DELETE') AS current_delete FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs'"],
      ['sequences', "SELECT n.nspname AS schema, c.relname AS name, s.seqstart::text AS seqstart, s.seqincrement::text AS seqincrement, pg_get_userbyid(c.relowner) AS owner FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['tables', "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"]
    ]
    for (const [id, sql] of statements) out.queries.push(await query(client, id, sql))
    if (continuation) out.queries.push(await query(client, 'tables', "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"))
    if (!continuation) {
      const discovered = out.queries.find((item) => item.id === 'migration_relations')
      const drizzlePresent = Boolean(discovered && Array.isArray(discovered.rows) && discovered.rows.some((item) => item.schema === 'drizzle' && item.name === '__drizzle_migrations'))
      if (drizzlePresent) out.queries.push(await query(client, 'drizzle_rows', 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id'))
      else out.queries.push({ id: 'drizzle_rows', classification: 'NOT_ATTEMPTED', reason: 'RELATION_NOT_IN_DISCOVERY' })
      const audit = out.queries.find((item) => item.id === 'audit')
      const auditAbsent = Boolean(audit && !audit.error && Array.isArray(audit.rows) && audit.rows.length === 0)
      if (auditAbsent) out.queries.push({ id: 'audit_grants', classification: 'NOT_ATTEMPTED', reason: 'PARENT_ABSENT' })
      else out.queries.push(await query(client, 'audit_grants', "SELECT r.rolname, a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a JOIN pg_roles r ON r.oid = a.grantee WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs' ORDER BY 1, 2"))
    }
    const tables = out.queries.find((item) => item.id === 'tables')
    const names = tables && Array.isArray(tables.rows) ? tables.rows : []
    let targets = names
    if (continuation) {
      if (inventoryDigest(names) !== continuation.inventoryDigest) { out.blocker = 'SCHEMA_DRIFT'; return }
      targets = Array.isArray(continuation.remaining) ? continuation.remaining : []
      out.inventoryDigest = continuation.inventoryDigest
    }
    const started = Date.now()
    let attempted = 0
    out.countBudget = { wallBudgetMs: COUNT_WALL_BUDGET_MS, maxStatements: COUNT_MAX_STATEMENTS, sourceTableDeclarations: SOURCE_TABLE_DECLARATIONS, discovered: names.length, targeted: targets.length }
    for (const table of targets) {
      if (attempted >= COUNT_MAX_STATEMENTS || (Date.now() - started) > COUNT_WALL_BUDGET_MS) {
        out.counts.push({ schema: table.schema, name: table.name, visibleToConnectedRole: true, globalTotal: false, classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET' })
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
      out.counts.push({ schema: table.schema, name: table.name, visibleToConnectedRole: true, globalTotal: false, classification: counted.classification || (n === null ? 'UNREADABLE' : 'OBSERVED'), n, error: counted.error })
    }
  } catch (error) {
    out.blocker = out.blocker || 'QUERY_FAILED'
    out.error = redact(error.message)
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); out.rolledBack = true } catch { out.rolledBack = false }
      try { await client.end() } catch { /* the session is abandoned */ }
    }
    const body = JSON.stringify(out)
    const digest = crypto.createHash('sha256').update(body).digest('hex')
    if (process.env.UE_CATALOG_TRANSPORT === 'private-job') {
      const chunkChars = ${EVIDENCE_CHUNK_CHARS}
      const maxBytes = ${EVIDENCE_MAX_BYTES}
      const maxChunks = ${EVIDENCE_MAX_CHUNKS}
      if (body.length > maxBytes) {
        process.stdout.write('UE_CATALOG_FRAME v1 chunks=0 sha256=' + digest + ' bytes=' + String(body.length) + ' overflow=1\\n')
      } else {
        const count = Math.max(1, Math.ceil(body.length / chunkChars))
        if (count > maxChunks) {
          process.stdout.write('UE_CATALOG_FRAME v1 chunks=0 sha256=' + digest + ' bytes=' + String(body.length) + ' overflow=1\\n')
        } else {
          for (let index = 0; index < count; index += 1) {
            process.stdout.write('UE_CATALOG_CHUNK ' + String(index + 1) + '/' + String(count) + ' ' + body.slice(index * chunkChars, (index + 1) * chunkChars) + '\\n')
          }
          process.stdout.write('UE_CATALOG_FRAME v1 chunks=' + String(count) + ' sha256=' + digest + ' bytes=' + String(body.length) + '\\n')
        }
      }
      process.stdout.write(END + '\\n')
      process.stdout.write('UE_CATALOG_SHA256 ' + digest + '\\n')
    } else {
      process.stdout.write(BEGIN + '\\n' + body + '\\n' + END + '\\n')
      process.stdout.write('UE_CATALOG_SHA256 ' + digest + '\\n')
    }
  }
}
main()
`
}

export const CATALOG_CONTRACT = {
  schema: CATALOG_SCHEMA,
  categories: [
    { id: 'database_identity', queries: [{ id: 'identity', accept: ['OBSERVED'] }] },
    { id: 'migration_discovery', queries: [{ id: 'migration_relations', accept: ['OBSERVED'] }] },
    { id: 'migration_history', queries: [
      { id: 'migration_columns', accept: ['OBSERVED'] },
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
  return 'OBSERVED'
}

function classifyCount(count) {
  if (!count) return 'NOT_ATTEMPTED'
  if (count.classification === 'NOT_ATTEMPTED') return 'NOT_ATTEMPTED'
  if (count.classification === 'TIMED_OUT' || timeoutText(count.error)) return 'TIMED_OUT'
  if (count.error || count.classification === 'UNREADABLE' || count.globalTotal !== false || count.visibleToConnectedRole !== true) return 'UNREADABLE'
  if (count.n === undefined || count.n === null || count.n === '') return 'UNREADABLE'
  return 'OBSERVED'
}

export function evaluateCatalogCompleteness(catalog, contract = CATALOG_CONTRACT) {
  const empty = { categories: [], legacyObservation: null, additionalProcedure: null, S2_02_PREIMAGE_COMPLETE: 'NO', S2_02_LEGACY_GATE: 'INDETERMINATE' }
  const refused = (reason) => ({ verdict: 'CATALOG_REFUSED', reason, ...empty })
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return { verdict: 'CATALOG_UNREADABLE', reason: 'CATALOG_OUTPUT_UNREADABLE', ...empty }
  }
  if (catalog.schema !== contract.schema) return refused('UNEXPECTED_SCHEMA_VERSION')
  if (['NO_IN_CONTAINER_PG_CLIENT', 'DATABASE_URL_ABSENT', 'QUERY_FAILED', 'CONTINUATION_REJECTED', 'SCHEMA_DRIFT'].includes(catalog.blocker)) return refused(catalog.blocker)
  if (catalog.rolledBack !== true) return refused('ROLLBACK_FAILED')
  const identity = catalog.identity
  if (catalog.blocker === 'IDENTITY_REFUSED' || !identity || identity.transaction_read_only !== 'on' || identity.database !== EXPECTED_DATABASE) {
    return refused('IDENTITY_REFUSED')
  }
  const identityRow = findQuery(catalog, 'identity')?.rows?.[0]
  if (identityRow && (identityRow.database !== identity.database || identityRow.transaction_read_only !== identity.transaction_read_only)) {
    return refused('IDENTITY_INCONSISTENT')
  }
  const categories = contract.categories.map((category) => {
    if (category.counts) {
      const tables = findQuery(catalog, 'tables')
      const rows = tables && !tables.error && Array.isArray(tables.rows) ? tables.rows : null
      if (!rows) return { id: category.id, classification: 'UNREADABLE', accepted: false, items: [] }
      const items = rows.map((table) => ({
        schema: table.schema,
        name: table.name,
        classification: classifyCount((catalog.counts ?? []).find((item) => item.schema === table.schema && item.name === table.name)),
      }))
      return { id: category.id, classification: items.every((item) => item.classification === 'OBSERVED') ? 'OBSERVED' : 'PARTIAL', accepted: items.every((item) => item.classification === 'OBSERVED'), items }
    }
    const queries = category.queries.map((spec) => {
      const classification = classifyCatalogQuery(spec, findQuery(catalog, spec.id), catalog)
      return { id: spec.id, classification, accepted: spec.accept.includes(classification) }
    })
    return { id: category.id, accepted: queries.every((item) => item.accepted), queries }
  })
  const functionClass = categories.flatMap((category) => category.queries ?? []).find((item) => item.id === 'function')?.classification
  const legacyObservation = functionClass === 'ABSENT_VERIFIED' ? 'LEGACY_TRANSITION_REQUIRED' : null
  const counts = categories.find((category) => category.id === 'preservation_counts')
  const additionalProcedure = counts && !counts.accepted
    ? 'Repeat one read-only session on the same revision for the NOT_ATTEMPTED or TIMED_OUT tables only. Keep count(*) on ONLY the relation, the 15s statement timeout, and the 45s wall budget. Do not disable row security, export rows, or raise the budget to force a complete result.'
    : null
  const complete = categories.every((category) => category.accepted)
  return {
    verdict: complete ? 'CATALOG_COMPLETE' : 'CATALOG_PARTIAL',
    reason: complete ? null : 'REQUIRED_EVIDENCE_INCOMPLETE',
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
  }
}

export function continuationDefect(token, binding, now = Date.now()) {
  if (!token || token.schema !== CONTINUATION_SCHEMA || token.database !== EXPECTED_DATABASE) return 'CONTINUATION_REJECTED'
  if (token.revision !== binding.revision || token.image !== binding.image) return 'REVISION_BINDING_CHANGED'
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

export function reconcileCatalogSessions(sessions, binding) {
  if (!Array.isArray(sessions) || sessions.length === 0) return { verdict: 'CATALOG_UNREADABLE', reason: 'EVIDENCE_MISSING' }
  const [first, ...rest] = sessions
  const times = sessions.map((session) => session.observedAt)
  if (times.some((value) => typeof value !== 'string') || new Set(times).size !== times.length) {
    return { verdict: 'CATALOG_REFUSED', reason: 'CONTINUATION_TIMESTAMPS' }
  }
  const merged = structuredClone(first.catalog)
  const baselineCounts = new Map((merged.counts ?? []).map((item) => [`${item.schema}.${item.name}`, item]))
  for (const session of rest) {
    const defect = continuationDefect(session.token, binding, session.now ?? Date.parse(session.observedAt))
    if (defect) return { verdict: 'CATALOG_REFUSED', reason: defect }
    const discovered = (session.catalog?.queries ?? []).find((item) => item.id === 'tables')
    if (!discovered || inventoryDigest(discovered.rows ?? []) !== session.token.inventoryDigest) {
      return { verdict: 'CATALOG_REFUSED', reason: 'SCHEMA_DRIFT' }
    }
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
  const evaluation = evaluateCatalogCompleteness(merged)
  return { verdict: evaluation.verdict, reason: evaluation.reason, evaluation, catalog: merged, sessions: times }
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
