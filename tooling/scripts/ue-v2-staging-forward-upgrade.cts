/** Dedicated staging-only forward upgrade. The image carries a qualified target
 * export and source-generated catalog queries. No seed/reset/restore operation
 * exists here. `apply` requires the exact successful rehearsal's plan digest. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { canonicalCatalogObject } from '../../apps/union-eyes/scripts/bootstrap-v2/catalog-normalization'
import { planCanonicalForwardUpgrade, retainedForwardProfile } from './lib/ue-v2-forward-upgrade'
import {
  assertForwardPreimage,
  executeForwardUpgrade,
  forwardDigest,
  readForwardCatalog,
  normalizeForwardCatalog,
  verifyForwardTarget,
  FORWARD_EVENT_CATALOG_QUERY,
  forwardUpgradeFailure,
  type ForwardUpgradeBundle,
} from './lib/ue-v2-forward-upgrade-runtime'

const APPLICATION_SOURCE = '6a60c95c9de17e9343e0414bb51766afbc190054'
const PLAN_DIGEST = '6ec71d4631810207ffad4e5b78046be219528d27608a3da13170f3bb96c41161'
const HOST = 'nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com'
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
let commitAttempted = false,
  commitAcknowledged = false
let failureStage = 'configuration'

async function main() {
  const operation = process.env.UE_UPGRADE_OPERATION
  assert(
    ['preflight', 'rehearse', 'apply'].includes(operation ?? ''),
    'UE_UPGRADE_OPERATION_REQUIRED',
  )
  assert.equal(process.env.UE_ENVIRONMENT, 'staging', 'UE_UPGRADE_STAGING_ONLY')
  assert.equal(process.env.PGHOST, HOST, 'UE_UPGRADE_STAGING_HOST_ONLY')
  assert.equal(process.env.PGDATABASE, 'ue_v2_staging', 'UE_UPGRADE_STAGING_DATABASE_ONLY')
  assert.equal(process.env.PGUSER, 'uev2admin', 'UE_UPGRADE_ORIGINAL_OPERATOR_ONLY')
  assert(process.env.PGPASSWORD, 'UE_UPGRADE_OPERATOR_PASSWORD_REQUIRED')
  assert(process.env.UE_UPGRADE_READ_DATABASE_URL, 'UE_UPGRADE_REAL_RUNTIME_CONNECTION_REQUIRED')
  const runtimeUrl = new URL(process.env.UE_UPGRADE_READ_DATABASE_URL)
  assert(
    ['postgres:', 'postgresql:'].includes(runtimeUrl.protocol) &&
      runtimeUrl.hostname === HOST &&
      runtimeUrl.pathname === '/ue_v2_staging' &&
      decodeURIComponent(runtimeUrl.username) === 'ue_staging_runtime',
    'UE_UPGRADE_RUNTIME_IDENTITY_REFUSED',
  )
  const operatorSource = process.env.UE_UPGRADE_OPERATOR_SOURCE_SHA
  assert(
    operatorSource && /^[a-f0-9]{40}$/.test(operatorSource),
    'UE_UPGRADE_OPERATOR_SOURCE_REQUIRED',
  )
  const root = process.env.UE_UPGRADE_ASSETS ?? '/operator/assets'
  failureStage = 'qualified-assets'
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  assert.equal(manifest.version, 1)
  assert.equal(manifest.applicationSourceSha, APPLICATION_SOURCE)
  assert.equal(manifest.operatorSourceSha, operatorSource)
  assert.equal(manifest.sourcePlanDigest, PLAN_DIGEST)
  for (const [file, digest] of Object.entries(manifest.files) as [string, string][]) {
    assert(/^(?:[a-z-]+\.json|schema\.sql)$/.test(file), 'UE_UPGRADE_ASSET_NAME_REFUSED')
    assert.equal(
      sha(fs.readFileSync(path.join(root, file))),
      digest,
      `UE_UPGRADE_ASSET_HASH:${file}`,
    )
  }
  assert.deepEqual(Object.keys(manifest.files).sort(), [
    'catalog-queries.json',
    'expected-catalog.json',
    'export-qualification.json',
    'schema.sql',
  ])
  const qualified = JSON.parse(
    fs.readFileSync(path.join(root, 'export-qualification.json'), 'utf8'),
  )
  assert.equal(qualified.applicationSourceSha, operatorSource)
  assert.equal(qualified.sourcePlanDigest, PLAN_DIGEST)
  assert.equal(qualified.localOnly, true)
  assert.equal(qualified.restoredDump, 'PASS')
  assert.equal(qualified.repeat, 'NOOP')
  assert.equal(qualified.restoredRepeat, 'NOOP')
  assert.equal(qualified.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
  assert.deepEqual(qualified.privilegeMismatches, [])
  const target = JSON.parse(fs.readFileSync(path.join(root, 'expected-catalog.json'), 'utf8'))
  assert.equal(
    sha(JSON.stringify(target.map(canonicalCatalogObject))),
    qualified.catalogDigest,
    'UE_UPGRADE_QUALIFIED_CATALOG_HASH',
  )
  const dump = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8')
  assert.equal(sha(dump), qualified.files['schema.sql'].sha256)
  const queries: string[] = JSON.parse(
    fs.readFileSync(path.join(root, 'catalog-queries.json'), 'utf8'),
  )
  assert(
    queries.length >= 20 && queries.every((sql) => /^\s*SELECT\s/i.test(sql)),
    'UE_UPGRADE_READONLY_QUERY_PROGRAM_REQUIRED',
  )
  if (!queries.includes(FORWARD_EVENT_CATALOG_QUERY)) queries.push(FORWARD_EVENT_CATALOG_QUERY)
  const c = new pg.Client({
    host: HOST,
    database: 'ue_v2_staging',
    user: 'uev2admin',
    password: process.env.PGPASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
    application_name: 'CHG-2026-0114-preserve-data-forward-upgrade',
  })
  const reader = new pg.Client({
    host: HOST,
    database: 'ue_v2_staging',
    user: 'ue_staging_runtime',
    password: decodeURIComponent(runtimeUrl.password),
    port: 5432,
    options: '-c role=union_eyes_runtime',
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
    application_name: 'CHG-2026-0114-read-only-preflight',
  })
  let transaction = false,
    readerTransaction = false
  try {
    failureStage = 'runtime-read-only-preflight'
    await reader.connect()
    await reader.query('BEGIN READ ONLY')
    readerTransaction = true
    await reader.query('SET LOCAL search_path=pg_catalog,public')
    const actor = (
      await reader.query(`SELECT current_user::text AS actor,session_user::text AS login,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS actor_privileged,
        (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=session_user) AS login_privileged`)
    ).rows[0]
    assert(
      actor.actor === 'union_eyes_runtime' && actor.login === 'ue_staging_runtime',
      'UE_UPGRADE_RUNTIME_PRINCIPAL_MISMATCH',
    )
    assert.equal(actor.actor_privileged, false, 'UE_UPGRADE_RUNTIME_ROLE_PRIVILEGED')
    assert.equal(actor.login_privileged, false, 'UE_UPGRADE_RUNTIME_LOGIN_PRIVILEGED')
    const version = Number(
      (await reader.query("SELECT current_setting('server_version_num') AS version")).rows[0]
        .version,
    )
    assert(version >= 160000 && version < 170000, 'UE_UPGRADE_POSTGRES_16_REQUIRED')
    const before = await readForwardCatalog(reader, queries)
    const profile = retainedForwardProfile(before, target, dump)
    const statements = [
      ...profile.prefix,
      ...(await planCanonicalForwardUpgrade({ before, after: profile.target, dump: profile.dump })),
      ...profile.suffix,
    ]
    const bundle: ForwardUpgradeBundle = {
      version: 1,
      applicationSourceSha: APPLICATION_SOURCE,
      catalogSourceSha: operatorSource,
      sourcePlanDigest: PLAN_DIGEST,
      catalogQueries: queries,
      before,
      target: profile.target,
      statements,
    }
    const planDigest = forwardDigest(statements),
      beforeDigest = forwardDigest(normalizeForwardCatalog(before))
    await reader.query('ROLLBACK')
    readerTransaction = false
    const common = {
      operation,
      changeRecord: 'CHG-2026-0114',
      applicationSourceSha: APPLICATION_SOURCE,
      operatorSourceSha: operatorSource,
      executionRunId: process.env.UE_UPGRADE_RUN_ID,
      executionJobName: process.env.UE_UPGRADE_JOB_NAME,
      sourcePlanDigest: PLAN_DIGEST,
      beforeDigest,
      planDigest,
      statements: statements.length,
      baseReleaseAcceptance: 'NOT_PROVEN_BY_DATABASE_UPGRADE',
      productionDeployment: false,
    }
    if (operation === 'preflight') {
      console.log(
        'UE_UPGRADE_RECEIPT ' +
          JSON.stringify({
            status: 'PASS_READ_ONLY_PREFLIGHT',
            ...common,
            changesCommitted: false,
          }),
      )
      return
    }
    if (operation === 'apply') {
      assert.equal(
        process.env.UE_UPGRADE_CONFIRM,
        `UPGRADE ue_v2_staging PRESERVING ROWS FOR ${APPLICATION_SOURCE}`,
        'UE_UPGRADE_CONFIRMATION_REQUIRED',
      )
      assert.equal(
        process.env.UE_UPGRADE_EXPECTED_PLAN_DIGEST,
        planDigest,
        'UE_UPGRADE_SUCCESSFUL_REHEARSAL_PLAN_REQUIRED',
      )
      assert.equal(
        process.env.UE_UPGRADE_EXPECTED_BEFORE_DIGEST,
        beforeDigest,
        'UE_UPGRADE_REHEARSAL_PREIMAGE_CHANGED',
      )
    }
    failureStage = 'operator-transaction'
    await c.connect()
    await c.query('BEGIN')
    transaction = true
    const result = await executeForwardUpgrade(c, bundle)
    failureStage = operation === 'apply' ? 'commit' : 'rehearsal-rollback'
    if (operation === 'apply') commitAttempted = true
    await c.query(operation === 'apply' ? 'COMMIT' : 'ROLLBACK')
    transaction = false
    if (operation === 'apply') commitAcknowledged = true
    failureStage = 'post-transaction-verification'
    await reader.query('BEGIN READ ONLY')
    readerTransaction = true
    await reader.query('SET LOCAL search_path=pg_catalog,public')
    let finalQualification
    if (operation === 'rehearse') {
      await assertForwardPreimage(reader, bundle)
    } else finalQualification = await verifyForwardTarget(reader, bundle)
    await reader.query('ROLLBACK')
    readerTransaction = false
    console.log(
      'UE_UPGRADE_RECEIPT ' +
        JSON.stringify({
          status:
            operation === 'apply'
              ? 'PASS_STAGING_FORWARD_UPGRADE'
              : 'PASS_STAGING_TRANSACTIONAL_REHEARSAL',
          ...common,
          ...result,
          finalQualification,
          changesCommitted: operation === 'apply',
          fullRollbackVerified: operation === 'rehearse',
        }),
    )
  } finally {
    if (transaction) await c.query('ROLLBACK').catch(() => {})
    if (readerTransaction) await reader.query('ROLLBACK').catch(() => {})
    await c.end().catch(() => {})
    await reader.end().catch(() => {})
  }
}
main().catch((error) => {
  console.error(
    'UE_UPGRADE_RECEIPT ' +
      JSON.stringify({
        status: 'FAIL',
        code: (error as { code?: string })?.code ?? 'UNKNOWN',
        operation: process.env.UE_UPGRADE_OPERATION,
        operatorSourceSha: process.env.UE_UPGRADE_OPERATOR_SOURCE_SHA,
        applicationSourceSha: APPLICATION_SOURCE,
        executionRunId: process.env.UE_UPGRADE_RUN_ID,
        executionJobName: process.env.UE_UPGRADE_JOB_NAME,
        failure: forwardUpgradeFailure(error),
        failureStage,
        changesQualified: false,
        changesCommitted: commitAcknowledged ? true : commitAttempted ? null : false,
        productionDeployment: false,
      }),
  )
  process.exitCode = 1
})
