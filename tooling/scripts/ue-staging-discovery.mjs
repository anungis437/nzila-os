import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const EXPECTED_HOST = 'nzila-staging-db.postgres.database.azure.com'
export const EXPECTED_DATABASE = 'nzila_os_staging'

// Parse credentials ourselves: pg connectionString SSL options must never
// overwrite certificate validation. Never include this object in receipts.
export function connectionOptions(raw) {
  const url = new URL(raw)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== EXPECTED_HOST || decodeURIComponent(url.pathname.slice(1)) !== EXPECTED_DATABASE || (url.port && url.port !== '5432')) {
    throw new Error('Credential target is outside the authorized staging database')
  }
  return {
    host: EXPECTED_HOST, port: 5432, database: EXPECTED_DATABASE,
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true, servername: EXPECTED_HOST },
    connectionTimeoutMillis: 20000, query_timeout: 90000,
    application_name: 'ue-staging-readonly-discovery',
  }
}

export function sanitizeError(error, raw = '') {
  let message = String(error?.message ?? error)
  const redact = [raw]
  try { const url = new URL(raw); redact.push(url.password, decodeURIComponent(url.password), url.username, decodeURIComponent(url.username)) } catch { /* no parsed credential */ }
  for (const value of redact.filter(Boolean).sort((a, b) => b.length - a.length)) message = message.split(value).join('[REDACTED]')
  message = message.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[REDACTED_DATABASE_URL]')
  return { name: error?.name ?? 'Error', code: error?.code ?? null, message }
}

export async function discover(client, receipt) {
  await client.query('BEGIN READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '60s'")
    await client.query("SET LOCAL lock_timeout = '5s'")
    const query = async (name, sql) => { receipt[name] = (await client.query(sql)).rows }
    await query('identity', `SELECT current_database() AS database, current_user AS current_user, session_user AS session_user, inet_server_addr()::text AS server_address, version(), current_setting('transaction_read_only') AS transaction_read_only, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl`)
    if (receipt.identity[0]?.database !== EXPECTED_DATABASE || receipt.identity[0]?.transaction_read_only !== 'on' || receipt.identity[0]?.ssl !== true) throw new Error('Database identity, TLS, or read-only assertion failed')
    await query('roles', 'SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls FROM pg_roles ORDER BY rolname')
    await query('memberships', 'SELECT r.rolname AS role, m.rolname AS member, a.admin_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member ORDER BY 1,2')
    await query('tables', `SELECT n.nspname AS schema,c.relname AS table,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m') ORDER BY 1,2`)
    await query('policies', 'SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies ORDER BY 1,2,3')
    await query('tableGrants', `SELECT n.nspname AS schema,c.relname AS table,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relkind IN ('r','p','v','m') ORDER BY 1,2,3,5`)
    await query('schemaGrants', `SELECT n.nspname AS schema,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname NOT LIKE 'pg_%' ORDER BY 1,2,3`)
    await query('columns', `SELECT table_schema,table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_schema,udt_name,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name,ordinal_position`)
    await query('indexes', `SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2,3`)
    await query('constraints', `SELECT n.nspname AS schema,c.relname AS table,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2,3`)
    await query('enums', `SELECT n.nspname AS schema,t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace ORDER BY 1,2,4`)
    await query('migrationRelations', `SELECT to_regclass('drizzle.__drizzle_migrations')::text AS drizzle,to_regclass('public.django_migrations')::text AS django`)
    if (receipt.migrationRelations[0].drizzle) await query('drizzleLedger', 'SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id')
    if (receipt.migrationRelations[0].django) await query('djangoLedger', 'SELECT app,name,applied FROM public.django_migrations ORDER BY app,name')
    // Only aggregate counts for known operational tables; never select row data.
    receipt.populations = []
    for (const table of ['organizations', 'organization_members', 'claims', 'grievances', 'documents', 'deadline_reminders', 'deadline_audit_events', 'deadline_reminder_executions', 'deadline_reassignment_convergence']) {
      if (!receipt.tables.some(row => row.schema === 'public' && row.table === table && ['r','p'].includes(row.relkind))) continue
      const result = await client.query(`SELECT count(*)::text AS visible_count FROM public."${table}"`)
      receipt.populations.push({ table, ...result.rows[0], interpretation: 'visibility depends on actual current role; not proof of all-row coverage' })
    }
    await client.query('ROLLBACK')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}

async function main() {
  const out = process.env.UE_DISCOVERY_OUTPUT_DIR
  if (!out) throw new Error('UE_DISCOVERY_OUTPUT_DIR is required')
  fs.mkdirSync(out, { recursive: true })
  const raw = process.env.UE_DISCOVERY_DATABASE_URL ?? ''
  delete process.env.UE_DISCOVERY_DATABASE_URL
  const receipt = { mission: 'UE-STAGING-RECOVERY-TO-GO', operation: 'read-only-census', sha: process.env.GITHUB_SHA, actor: process.env.GITHUB_ACTOR, runId: process.env.GITHUB_RUN_ID, observedAt: new Date().toISOString(), expectedHost: EXPECTED_HOST, expectedDatabase: EXPECTED_DATABASE, status: 'FAIL' }
  let client
  try {
    const options = connectionOptions(raw)
    const require = createRequire(path.resolve(process.env.UE_DISCOVERY_PG_DIR, 'package.json'))
    const { Client } = require('pg')
    client = new Client(options)
    await client.connect()
    await discover(client, receipt)
    receipt.status = 'PASS'
  } catch (error) {
    receipt.error = sanitizeError(error, raw)
    process.exitCode = 1
  } finally {
    if (client) await client.end().catch(() => {})
    fs.writeFileSync(path.join(out, 'database-census.json'), JSON.stringify(receipt, null, 2) + '\n')
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, 'database-census.json'))).digest('hex')
    fs.writeFileSync(path.join(out, 'database-census.sha256'), digest + '  database-census.json\n')
    console.log(JSON.stringify({ operation: receipt.operation, status: receipt.status, error: receipt.error ?? null }))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(JSON.stringify(sanitizeError(error))); process.exitCode = 1 })
