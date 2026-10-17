import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { format } from 'prettier'
import { mobileDevices } from '../../db/schema/mobile-devices-schema'
import {
  collectModels,
  currentModelServerDefaults,
  folder,
  hash,
  quote,
  retainCurrentModelBaseline,
  root,
} from './source'
import { assertLocalTarget } from './installer'

const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'

function databaseError(error: unknown): pg.DatabaseError | null {
  if (error instanceof pg.DatabaseError) return error
  if (error instanceof Error && error.cause !== undefined) return databaseError(error.cause)
  return null
}

export async function proveCurrentCallerDefaults(wheelhouse: string) {
  const sourceDigests = Object.fromEntries(
    [
      'apps/union-eyes/scripts/bootstrap-v2/source.ts',
      'apps/union-eyes/scripts/bootstrap-v2/current_models.py',
      'apps/union-eyes/scripts/bootstrap-v2/defaults-native.ts',
      'apps/union-eyes/db/schema/mobile-devices-schema.ts',
      'apps/union-eyes/backend/notifications/models.py',
    ].map((file) => [file, hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))]),
  )
  const collected = collectModels(wheelhouse)
  const model = collected.models.find((entry) => entry.table === 'mobile_devices')
  if (!model) throw new Error('UE_V2_CANONICAL_DEVICE_MODEL_REQUIRED')
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api')
  const snapshot = generateDrizzleJson({ mobileDevices })
  const baseline = structuredClone(snapshot)
  retainCurrentModelBaseline(baseline.tables['public.mobile_devices'].columns, model.columns)
  baseline.tables['public.mobile_devices'].indexes = {}
  baseline.tables['public.mobile_devices'].foreignKeys = {}
  baseline.tables['public.mobile_devices'].uniqueConstraints = {}
  baseline.tables['public.mobile_devices'].checkConstraints = {}
  snapshot.tables['public.mobile_devices'].foreignKeys = {}
  const callerDefaults = await generateMigration(baseline, snapshot)
  const modelDefaults = currentModelServerDefaults(model)
  const name = `ue-v2-defaults-${randomUUID()}`
  const database = `ue_v2_clean_defaults_${randomUUID().replaceAll('-', '')}`
  const password = randomUUID()
  const probePassword = randomUUID()
  const clients: pg.Client[] = []
  let started = false
  const docker = (args: string[]) =>
    execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim()
  try {
    docker([
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '--label',
      'nzila.mission=UE_BOOTSTRAP_V2_DEFAULTS',
      '--env',
      `POSTGRES_PASSWORD=${password}`,
      '--publish',
      '127.0.0.1::5432',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,size=512m',
      '--memory',
      '768m',
      '--cpus',
      '2',
      image,
    ])
    started = true
    const mapping = docker(['port', name, '5432/tcp'])
    const port = Number(mapping.match(/127\.0\.0\.1:(\d+)/)?.[1])
    const config = { host: '127.0.0.1', port, database }
    assertLocalTarget(config)
    let responsive = false
    for (let attempt = 0; attempt < 60; attempt++) {
      const status = docker([
        'exec',
        name,
        'sh',
        '-c',
        'pg_isready -h 127.0.0.1 -U postgres >/dev/null; printf "%s" "$?"',
      ])
      if (status === '0') {
        responsive = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!responsive) throw new Error('UE_V2_DEFAULT_PROOF_POSTGRES_START_FAILED')
    const operator = new pg.Client({ ...config, database: 'postgres', user: 'postgres', password })
    clients.push(operator)
    await operator.connect()
    await operator.query(`CREATE DATABASE ${quote(database)}`)
    const owner = new pg.Client({ ...config, user: 'postgres', password })
    clients.push(owner)
    await owner.connect()
    const ddl = collected.ddl.filter((entry) => entry.owner === model.table)
    if (!ddl.length) throw new Error('UE_V2_DEFAULT_PROOF_CURRENT_DDL_REQUIRED')
    for (const entry of ddl) await owner.query(entry.sql)
    const role = `ue_v2_default_${randomUUID().replaceAll('-', '')}`
    await owner.query(
      `CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${probePassword}'`,
    )
    await owner.query(`GRANT USAGE ON SCHEMA public TO ${quote(role)}`)
    await owner.query(`GRANT INSERT, SELECT ON public.mobile_devices TO ${quote(role)}`)
    const ordinary = new pg.Client({ ...config, user: role, password: probePassword })
    clients.push(ordinary)
    await ordinary.connect()
    const privileges = (
      await ordinary.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
        'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
      )
    ).rows[0]
    assert.equal(privileges.rolsuper, false)
    assert.equal(privileges.rolbypassrls, false)
    const application = drizzle(ordinary, { schema: { mobileDevices } })
    const insert = () =>
      application
        .insert(mobileDevices)
        .values({
          deviceToken: 'synthetic-device-token',
          deviceId: 'synthetic-device-id',
          userId: 'synthetic-default-user',
          platform: 'pwa',
        })
        .returning()
    await assert.rejects(
      insert,
      (error: unknown) =>
        databaseError(error)?.code === '23502' && databaseError(error)?.column === 'id',
    )
    for (const sql of modelDefaults) await owner.query(sql)
    for (const sql of callerDefaults) await owner.query(sql)
    const [created] = await insert()
    assert.match(created.id, /^[0-9a-f-]{36}$/)
    assert.equal(created.pushEnabled, true)
    assert.equal(created.timezone, 'UTC')
    assert.equal(created.locale, 'en-US')
    assert.deepEqual(created.capabilities, {
      camera: true,
      gps: true,
      biometric: true,
      push: true,
    })
    assert.deepEqual(created.complianceIssues, [])
    assert.deepEqual(created.metadata, {})
    assert(created.registeredAt instanceof Date)
    assert(created.lastActiveAt instanceof Date)
    const audit = (
      await ordinary.query<{ created_at: Date; updated_at: Date }>(
        'SELECT created_at,updated_at FROM public.mobile_devices WHERE id=$1',
        [created.id],
      )
    ).rows[0]
    assert(audit.created_at instanceof Date)
    assert(audit.updated_at instanceof Date)
    for (const [file, digest] of Object.entries(sourceDigests))
      assert.equal(
        hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')),
        digest,
        `UE_V2_DEFAULT_PROOF_SOURCE_CHANGED:${file}`,
      )
    return {
      lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
      contractVersion: '2.0',
      scope: 'LOCAL_SYNTHETIC_CURRENT_CALLER_DEFAULTS',
      missingServerDefaultReproduced: 'PASS',
      actualDrizzleInsertWithOmittedIdentityAndAuditFields: 'PASS',
      scalarAndJsonDefaults: 'PASS',
      nonOwnerNonBypassCaller: 'PASS',
      sourceDigest: model.sourceDigest,
      sourceDigests,
      modelDefaultSqlDigest: hash(JSON.stringify(modelDefaults)),
      callerDefaultSqlDigest: hash(JSON.stringify(callerDefaults)),
      sourceModelChecks: collected.sourceModelChecks,
      historicalMigrationReplay: false,
      tenantIsolationQualification: 'NOT_PROVEN',
      wholeApplicationQualification: 'NOT_PROVEN',
      databaseScope: 'EPHEMERAL_DEFAULT_PROBE_ONLY',
      productionOrStagingConnections: 0,
    }
  } finally {
    for (const client of clients.reverse()) await client.end()
    if (started) {
      const residual = docker([
        'ps',
        '-aq',
        '--filter',
        `name=^${name}$`,
        '--filter',
        'label=nzila.mission=UE_BOOTSTRAP_V2_DEFAULTS',
      ])
      if (!residual) throw new Error('UE_V2_DEFAULT_PROOF_CONTAINER_OWNERSHIP_LOST')
      docker(['rm', '-f', residual])
      if (
        docker([
          'ps',
          '-aq',
          '--filter',
          `name=^${name}$`,
          '--filter',
          'label=nzila.mission=UE_BOOTSTRAP_V2_DEFAULTS',
        ])
      )
        throw new Error('UE_V2_DEFAULT_PROOF_CONTAINER_RESIDUAL')
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void proveCurrentCallerDefaults(process.env.UE_V2_WHEELHOUSE ?? '')
    .then(async (proof) => {
      const bytes = await format(JSON.stringify(proof), { parser: 'json' })
      const target = path.join(folder, 'UE_BOOTSTRAP_V2_CURRENT_DEFAULT_PROOF.json')
      if (process.argv.includes('--check'))
        assert.equal(readFileSync(target, 'utf8'), bytes, 'UE_V2_DEFAULT_PROOF_ARTIFACT_DRIFT')
      else writeFileSync(target, bytes)
      process.stdout.write(bytes)
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
      process.exitCode = 1
    })
}
