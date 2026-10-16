import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import {
  applyV2,
  catalogDigest,
  connectLocalV2,
  createCurrentState,
  inspectCatalog,
} from '../bootstrap-v2/installer'
import { compileMinimumRoleProvisioningSql } from '../bootstrap-v2/minimum-installer'
import { buildPlan, hash, quote } from '../bootstrap-v2/source'

/**
 * Staging enablement: materialises the qualified Canonical Bootstrap V2 schema in the pinned local
 * pgvector container exactly as the clean-room does (reference catalog, then applyV2 with receipt),
 * and exports it as SQL for restore into the Azure staging server. The installer itself stays
 * local-only; this tool does not weaken that guard.
 */
const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
const docker = (args: string[], env?: NodeJS.ProcessEnv) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    env: env ?? process.env,
    timeout: 300000,
    maxBuffer: 512 * 1024 * 1024,
  })

async function main() {
  const out = process.argv[2]
  assert(out, 'output directory required')
  mkdirSync(out, { recursive: true })
  const wheelhouse = process.env.UE_V2_WHEELHOUSE
  assert(wheelhouse, 'UE_V2_WHEELHOUSE_REQUIRED')
  const plan = await buildPlan(wheelhouse)
  const planDigest = hash(JSON.stringify(plan))
  const password = randomBytes(24).toString('hex')
  const name = `ue-v2-staging-export-${randomUUID()}`
  let container: string | undefined
  const clients: pg.Client[] = []
  try {
    container = docker(
      [
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        name,
        '--label',
        'nzila.mission=UE_V2_STAGING_EXPORT',
        '--memory',
        '1g',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=768m',
        '-p',
        '127.0.0.1::5432',
        '-e',
        'POSTGRES_PASSWORD',
        image,
      ],
      { ...process.env, POSTGRES_PASSWORD: password },
    ).trim()
    const binding = JSON.parse(
      docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]),
    )
    const port = Number(binding['5432/tcp'][0].HostPort)
    const config = { host: '127.0.0.1', port, user: 'postgres', password }
    let admin: pg.Client | undefined
    for (let attempt = 0; attempt < 60; attempt++) {
      const probe = new pg.Client({
        ...config,
        database: 'postgres',
        connectionTimeoutMillis: 1000,
      })
      try {
        await probe.connect()
        admin = probe
        break
      } catch {
        await probe.end().catch(() => undefined)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    assert(admin, 'UE_V2_EXPORT_DATABASE_NOT_RESPONSIVE')
    clients.push(admin)
    await admin.query(compileMinimumRoleProvisioningSql())
    const database = async (suffix: string) => {
      const db = `ue_v2_clean_${suffix}`
      await admin!.query(`CREATE DATABASE ${quote(db)} OWNER ue_v2_owner`)
      const client = await connectLocalV2({ ...config, database: db })
      clients.push(client)
      return client
    }
    const reference = await database('reference')
    await reference.query('BEGIN')
    await createCurrentState(reference, plan)
    await reference.query('COMMIT')
    const expected = await inspectCatalog(reference)
    const target = await database('staging_export')
    const applied = await applyV2(target, plan, expected)
    assert.equal(applied.result, 'CREATED')
    assert.equal(applied.catalogDigest, catalogDigest(expected))
    const dumpArgs = [
      'exec',
      '-u',
      'postgres',
      container,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'ue_v2_clean_staging_export',
    ]
    const dump = docker([...dumpArgs, '--schema-only', '--no-comments'])
    const receipt = docker([...dumpArgs, '--data-only', '--table=public.ue_v2_bootstrap_receipt'])
    writeFileSync(path.join(out, 'schema.sql'), dump)
    writeFileSync(path.join(out, 'receipt.sql'), receipt)
    writeFileSync(path.join(out, 'expected-catalog.json'), JSON.stringify(expected))
    const summary = {
      sourcePlanDigest: planDigest,
      catalogDigest: catalogDigest(expected),
      objects: expected.length,
      image,
    }
    writeFileSync(path.join(out, 'export-summary.json'), JSON.stringify(summary, null, 2))
    process.stdout.write(`${JSON.stringify(summary)}\n`)
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()))
    if (container) docker(['rm', '-f', container])
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
