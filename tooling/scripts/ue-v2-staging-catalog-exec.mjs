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
function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\\/\\/[^\\s'"]+/gi, 'postgresql://[redacted]')
    .replace(/\\b(password|pwd|secret|token|accountkey)\\s*[:=]\\s*\\S+/gi, '$1=[redacted]')
}
function ident(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('IDENTIFIER_REFUSED')
  return '"' + value.replaceAll('"', '""') + '"'
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
    return { id, error: redact(error.message) }
  }
}
async function main() {
  const out = { schema: 'ue-v2-staging-catalog/v1', queries: [], rolledBack: false }
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
    const statements = [
      ['migration_relations', "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relname IN ('__drizzle_migrations','drizzle_migrations','schema_migrations','django_migrations') AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['migration_columns', "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('__drizzle_migrations','drizzle_migrations','schema_migrations','django_migrations') AND table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2, 3"],
      ['drizzle_rows', "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id"],
      ['roles', "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname"],
      ['memberships', "SELECT r.rolname AS role, m.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid JOIN pg_roles m ON m.oid = am.member ORDER BY 1, 2"],
      ['relations', "SELECT n.nspname AS schema, c.relname AS name, c.relkind, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','S') AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['policies', "SELECT n.nspname AS schema, c.relname AS name, pol.polname, pol.polcmd, pol.polpermissive, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr, pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace ORDER BY 1, 2, 3"],
      ['function', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, p.prosecdef, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'user_management' AND p.proname = 'auth_business_org_authorized'"],
      ['security_definer', "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner, md5(p.prosrc) AS source_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['event_trigger', "SELECT e.evtname, e.evtenabled, e.evtevent, n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid JOIN pg_namespace n ON n.oid = p.pronamespace WHERE e.evtname = 'ue_guard_deadline_reassignment_convergence_policy'"],
      ['audit', "SELECT to_regclass('audit_security.audit_logs') AS rel, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl, c.relrowsecurity, c.relforcerowsecurity, has_table_privilege(current_user, c.oid, 'SELECT') AS current_select, has_table_privilege(current_user, c.oid, 'INSERT') AS current_insert, has_table_privilege(current_user, c.oid, 'UPDATE') AS current_update, has_table_privilege(current_user, c.oid, 'DELETE') AS current_delete FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs'"],
      ['audit_grants', "SELECT r.rolname, a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a JOIN pg_roles r ON r.oid = a.grantee WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs' ORDER BY 1, 2"],
      ['sequences', "SELECT n.nspname AS schema, c.relname AS name, s.seqstart::text AS seqstart, s.seqincrement::text AS seqincrement, pg_get_userbyid(c.relowner) AS owner FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"],
      ['tables', "SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2"]
    ]
    for (const [id, sql] of statements) out.queries.push(await query(client, id, sql))
    const tables = out.queries.find((item) => item.id === 'tables')
    out.counts = []
    const names = tables && tables.rows ? tables.rows : []
    if (names.length > 60) out.counts.push({ classification: 'NOT_TAKEN', reason: 'TABLE_COUNT_CAP', tables: names.length })
    else for (const table of names) {
      try {
        const sql = 'SELECT count(*)::bigint AS n FROM ONLY ' + ident(table.schema) + '.' + ident(table.name)
        const counted = await query(client, 'count_' + table.schema + '_' + table.name, sql)
        out.counts.push({ schema: table.schema, name: table.name, visibleToConnectedRole: true, globalTotal: false, result: counted })
      } catch (error) {
        out.counts.push({ schema: table.schema, name: table.name, visibleToConnectedRole: true, globalTotal: false, error: redact(error.message) })
      }
    }
  } catch (error) {
    out.blocker = out.blocker || 'QUERY_FAILED'
    out.error = redact(error.message)
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); out.rolledBack = true } catch { out.rolledBack = false }
      try { await client.end() } catch { /* the session is abandoned */ }
    }
    process.stdout.write(BEGIN + '\\n' + JSON.stringify(out) + '\\n' + END + '\\n')
  }
}
main()
`
}

export function parseCatalogStdout(text) {
  const redacted = redact(text)
  const start = redacted.lastIndexOf(MARK_BEGIN)
  const end = redacted.lastIndexOf(MARK_END)
  if (start < 0 || end < start) return { ok: false, blocker: 'EXEC_OUTPUT_WITHOUT_CATALOG_MARKER', transcript: redacted.slice(-4000) }
  try {
    const body = JSON.parse(redacted.slice(start + MARK_BEGIN.length, end).trim())
    return { ok: !body.blocker && body.rolledBack === true && body.identity?.transaction_read_only === 'on' && body.identity?.database === EXPECTED_DATABASE, body }
  } catch {
    return { ok: false, blocker: 'CATALOG_OUTPUT_UNREADABLE', transcript: redacted.slice(-4000) }
  }
}

export function execCommandLine(source) {
  const encoded = Buffer.from(source).toString('base64')
  const node = `node -e "eval(Buffer.from('${encoded}','base64').toString())"`
  const args = [
    'containerapp', 'exec',
    '--resource-group', RESOURCE_GROUP,
    '--name', CONTAINER_APP,
    '--revision', EXPECTED_REVISION,
    '--container', CONTAINER_NAME,
    '--command', node,
  ]
  const quoted = args.map((arg) => `'${arg.replaceAll("'", `'"'"'`)}'`).join(' ')
  return ['timeout', '90', 'script', '-q', '-e', '-c', `az ${quoted}`, '/dev/null']
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
    && Number(revision?.trafficWeight) === 100
    && revision?.healthState === 'Healthy'
    && container?.image === EXPECTED_IMAGE
}

export async function executeCatalog(env, call) {
  const defects = liveAuthorization(env)
  const report = {
    schema: 'ue-v2-staging-catalog-exec/v1',
    defects,
    subscriptionId: null,
    tenantId: null,
    caller: null,
    execPermission: 'NOT_OBSERVED',
    revision: 'NOT_OBSERVED',
    execAttempted: false,
    catalog: null,
  }
  if (defects.length) return { exitCode: 1, report }

  const account = await call(['account', 'show', '--query', '{subscriptionId:id,tenantId:tenantId}', '-o', 'json'])
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

  const token = await call(['account', 'get-access-token', '--query', 'accessToken', '-o', 'tsv'])
  if (token.code !== 0) {
    report.defects.push('CALLER_UNREAD')
    return { exitCode: 1, report }
  }
  report.caller = principalFromAccessToken(token.stdout.trim())
  if (report.caller.tid !== TENANT_ID) {
    report.defects.push('WRONG_CALLER_TENANT')
    return { exitCode: 1, report }
  }

  const assignments = await call(['role', 'assignment', 'list', '--scope', GROUP_ID, '--include-inherited', '-o', 'json'])
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
    const definition = await call(['role', 'definition', 'list', '--name', item.roleDefinitionName, '--scope', GROUP_ID, '-o', 'json'])
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

  const revision = await call([
    'containerapp', 'revision', 'show',
    '--resource-group', RESOURCE_GROUP,
    '--name', CONTAINER_APP,
    '--revision', EXPECTED_REVISION,
    '--query', '{name:name,healthState:properties.healthState,trafficWeight:properties.trafficWeight,runningState:properties.runningState,containers:properties.template.containers[].{name:name,image:image}}',
    '-o', 'json',
  ])
  if (revision.code !== 0) {
    report.defects.push('REVISION_UNREAD')
    report.revisionError = redact(revision.stderr).slice(0, 500)
    return { exitCode: 4, report }
  }
  report.revision = parseJson(revision.stdout, 'REVISION')
  if (!revisionAccepted(report.revision)) {
    report.defects.push('REVISION_BINDING_CHANGED')
    return { exitCode: 4, report }
  }

  report.execAttempted = true
  const exec = await call(execCommandLine(containerSource()))
  report.execExitCode = exec.code
  const parsed = parseCatalogStdout(`${exec.stdout}\n${exec.stderr}`)
  report.catalog = parsed.body ?? null
  if (!parsed.ok) {
    report.defects.push(parsed.blocker ?? parsed.body?.blocker ?? 'CATALOG_INCOMPLETE')
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

function callAz(bin, args) {
  const result = spawnSync(bin, args, { encoding: 'utf8' })
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
  const result = await executeCatalog(process.env, (args) => callAz(process.env.UE_CATALOG_AZ_BIN || 'az', args))
  const digest = writeReport(directory, result.report)
  console.log(`catalog=${result.exitCode === 0 ? 'OBSERVED' : 'INCOMPLETE'} sha256=${digest} defects=${result.report.defects.join(',')}`)
  process.exit(result.exitCode)
}
