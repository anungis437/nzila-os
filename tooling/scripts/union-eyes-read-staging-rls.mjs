#!/usr/bin/env node
import fs from 'node:fs'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { approvalDefects } from './lib/union-eyes-deployment-safety.mjs'
import { COUNT_NAMES, databaseProofId, fixtureDefects, isolationDefects, numericCount, parsePsqlFrames, sha256 } from './lib/union-eyes-staging-proof.mjs'

// File arguments carry signed release/fixture authority, never a claimed
// candidate revision. Existing fixture rows are read; none are provisioned here.
const [output, manifestPath, approvalPath, trustPath, foundation] = process.argv.slice(2)
try {
  if (output) fs.rmSync(output, { force: true })
  if (!output || !manifestPath || !approvalPath || !trustPath || foundation !== 'true') throw new Error('STAGING_RLS_ARGUMENTS_INVALID')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'))
  const defects = approvalDefects(approval, fs.readFileSync(trustPath, 'utf8'), manifest, Date.now())
  defects.push(...fixtureDefects(approval.acceptanceFixture, approval))
  if (manifest.environment !== 'staging' || defects.length) throw new Error(`STAGING_PROBE_UNAUTHORIZED:${defects.join(',')}`)
  if (!process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || !process.env.RLS_VERIFY_DATABASE_URL) throw new Error('STAGING_DATABASE_CONNECTIONS_REQUIRED')
  const fixture = approval.acceptanceFixture
  const a = fixture.tenantA
  const b = fixture.tenantB
  const query = (url, sql, frames) => {
    // Pass libpq conninfo explicitly, so URI/keyword parameters are expanded.
    // Never echo the command or raw errors (which can contain credentials).
    const result = spawnSync('psql', [url, '-X', '-q', '-A', '-t', '-w', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
      input: sql, encoding: 'utf8', env: process.env, timeout: 60000,
    })
    return parsePsqlFrames(result.stdout ?? '', result.stderr ?? '', result.status, frames)
  }
  const catalogSql = `BEGIN READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT 'UE_roles=' || COALESCE(json_agg(json_build_object('rolname',rolname,'rolsuper',rolsuper,'rolbypassrls',rolbypassrls)), '[]'::json)::text FROM pg_roles WHERE rolname IN ('union_eyes_runtime','union_eyes_system');
SELECT 'UE_ledger=' || COALESCE(json_agg(json_build_object('hash',hash)), '[]'::json)::text FROM drizzle.__drizzle_migrations;
SELECT 'UE_database=' || current_database();
ROLLBACK;`
  const catalog = query(process.env.RLS_MIGRATION_ADMIN_DATABASE_URL, catalogSql, ['roles', 'ledger', 'database'])
  if (catalog.database !== fixture.databaseName) throw new Error('STAGING_DATABASE_MISMATCH')
  const count = (name, where) => `SELECT 'UE_${name}=' || count(*) FROM public.grievances WHERE ${where};`
  const context = (tenant) => `SET LOCAL app.current_user_id = '${tenant.userId}';\nSET LOCAL app.current_org_id = '${tenant.organizationId}';`
  const forged = (tenant, other, name) => `DO $probe$
DECLARE affected integer; detail text;
BEGIN
  BEGIN
    INSERT INTO public.grievances
      SELECT (jsonb_populate_record(NULL::public.grievances, to_jsonb(g) ||
        jsonb_build_object('id', '${crypto.randomUUID()}', 'organization_id', '${other.organizationId}',
          'grievance_number', 'UE-RLS-${crypto.randomUUID()}'))).*
      FROM public.grievances AS g WHERE g.id = '${tenant.recordId}';
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE EXCEPTION 'FORGED_WRITE_NOT_REFUSED:%', affected;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS detail = MESSAGE_TEXT;
    IF detail NOT LIKE 'new row violates row-level security policy%' THEN RAISE; END IF;
  END;
END $probe$;
SELECT 'UE_${name}=42501';`
  // current_user, pg_roles, positive reads and denials use the same runtime
  // connection/transaction. Unexpected success aborts and rolls back on close.
  // Expected RLS write failures use subtransactions; nothing is committed.
  const runtimeSql = `BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
DO $identity$
BEGIN
  IF current_user <> 'union_eyes_runtime' OR session_user <> 'union_eyes_runtime'
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND NOT rolsuper AND NOT rolbypassrls)
    THEN RAISE EXCEPTION 'RUNTIME_IDENTITY_INVALID'; END IF;
END $identity$;
SELECT 'UE_identity=' || json_build_object('currentUser',current_user,'sessionUser',session_user,'databaseName',current_database(),'rolsuper',rolsuper,'rolbypassrls',rolbypassrls)::text FROM pg_roles WHERE rolname = current_user;
${context(a)}
${count('fixtureA', `id = '${a.recordId}' AND organization_id = '${a.organizationId}'`)}
${count('ownA', `id = '${a.recordId}'`)}
${context(b)}
${count('fixtureB', `id = '${b.recordId}' AND organization_id = '${b.organizationId}'`)}
${count('ownB', `id = '${b.recordId}'`)}
${context(a)}
${count('aReadsB', `id = '${b.recordId}' OR organization_id = '${b.organizationId}'`)}
${forged(a, b, 'aToB')}
${context(b)}
${count('bReadsA', `id = '${a.recordId}' OR organization_id = '${a.organizationId}'`)}
${forged(b, a, 'bToA')}
SET LOCAL app.current_user_id = '';
SET LOCAL app.current_org_id = '';
${count('emptyContext', 'true')}
ROLLBACK;`
  const observed = query(process.env.RLS_VERIFY_DATABASE_URL, runtimeSql, ['identity', ...COUNT_NAMES, 'aToB', 'bToA'])
  const databaseIsolation = {
    kind: 'database-isolation', source: 'deployed-database', transport: 'postgres',
    releaseSha: manifest.releaseSha, databaseBaseline: approval.databaseBaseline,
    observedAt: new Date().toISOString(), fixture,
    test: 'grievances-two-tenant-v1', executedSql: catalogSql + '\n' + runtimeSql,
    executedSqlSha256: sha256(catalogSql + '\n' + runtimeSql),
    ledgerSha256: sha256(JSON.stringify(JSON.parse(catalog.ledger))),
    identity: JSON.parse(observed.identity),
    counts: Object.fromEntries(COUNT_NAMES.map((name) => [name, numericCount(observed[name])])),
    forgedWrites: { aToB: observed.aToB, bToA: observed.bToA },
  }
  databaseIsolation.evidenceId = databaseProofId(databaseIsolation)
  const failures = isolationDefects(databaseIsolation, approval, manifest)
  if (failures.length) throw new Error(failures.join(','))
  const proof = {
    foundation: { source: 'github-environment-variable', name: 'UE_RLS_FOUNDATION_ENFORCED_STAGING', value: true },
    runtimeRoles: { source: 'pg_roles', rows: JSON.parse(catalog.roles) },
    ledger: { source: 'drizzle.__drizzle_migrations', rows: JSON.parse(catalog.ledger) },
    databaseIsolation,
  }
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n')
} catch (error) {
  // Emit fixed diagnostic codes only, never raw PostgreSQL text or credentials.
  const message = String(error.message)
  process.stderr.write((/^[A-Z_0-9:,]+$/.test(message) ? message : 'STAGING_PROOF_FAILED') + '\n')
  process.exitCode = 1
}
