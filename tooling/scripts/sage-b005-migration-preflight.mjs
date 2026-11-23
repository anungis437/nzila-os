#!/usr/bin/env node
/**
 * SAGE B-005 migration preflight (offline / isolated Postgres).
 *
 * Modes:
 *   verify   — checksum every 0032+ `*_sage_*.sql` against migration-manifest.json
 *   apply    — apply the SAGE chain to DATABASE_URL (or --url), then re-verify tables
 *   receipt  — write a migration section for the B-005 qualification receipt
 *
 * Never claims B-005 closure. Never writes to production hosts by default —
 * apply refuses hostnames that look like production unless --allow-prod-host
 * is explicitly passed (still does not elevate b005Closure).
 *
 * Usage:
 *   node tooling/scripts/sage-b005-migration-preflight.mjs verify
 *   node tooling/scripts/sage-b005-migration-preflight.mjs apply --url "$SAGE_PG_TEST_URL"
 *   node tooling/scripts/sage-b005-migration-preflight.mjs receipt --out reports/proof-runs/sage-b005-migration.json
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'
import {
  B005_REQUIRED_TAIL,
  MIGRATIONS_DIR,
  listSageMigrationFiles,
  verifySageMigrationChain,
} from './lib/sage-migration-chain.mjs'

const PROD_HOST_HINTS = [/prod/i, /production/i, /\.prod\./i]

function errorCode(message) {
  return new Error('SAGE_B005_MIGRATION_PREFLIGHT: ' + message)
}

function parseArgs(argv) {
  const args = argv.filter((a) => a !== '--')
  const mode = args[0]
  if (!['verify', 'apply', 'receipt'].includes(mode)) {
    throw errorCode('MODE_REQUIRED (verify|apply|receipt)')
  }
  const opts = { mode, url: process.env.SAGE_PG_TEST_URL || process.env.DATABASE_URL || null, out: null, allowProdHost: false }
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    if (a === '--url') opts.url = args[++i]
    else if (a === '--out') opts.out = args[++i]
    else if (a === '--allow-prod-host') opts.allowProdHost = true
    else throw errorCode(`UNKNOWN_ARGUMENT:${a}`)
  }
  return opts
}

function assertSafeApplyUrl(url, allowProdHost) {
  if (!url || typeof url !== 'string') throw errorCode('DATABASE_URL_REQUIRED')
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw errorCode('DATABASE_URL_INVALID')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw errorCode('DATABASE_URL_PROTOCOL')
  }
  const host = parsed.hostname || ''
  if (!allowProdHost && PROD_HOST_HINTS.some((re) => re.test(host))) {
    throw errorCode('PRODUCTION_HOST_REFUSED')
  }
  return parsed
}

export async function applySageMigrationChain(url, { allowProdHost = false } = {}) {
  assertSafeApplyUrl(url, allowProdHost)
  const files = listSageMigrationFiles()
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  const applied = []
  try {
    for (const file of files) {
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      await sql.unsafe(body)
      applied.push(file)
    }
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name like 'sage_%'
      order by table_name
    `
    const names = tables.map((r) => r.table_name)
    const requiredTables = [
      'sage_institutional_mandate',
      'sage_institutional_office_holding',
      'sage_institutional_conflict_attestation',
      'sage_accountability_adoption',
    ]
    const missingTables = requiredTables.filter((t) => !names.includes(t))
    return {
      applied,
      sageTableCount: names.length,
      sageTables: names,
      missingRequiredTables: missingTables,
      result: missingTables.length === 0 ? 'APPLY_OK' : 'APPLY_INCOMPLETE',
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export async function runMigrationPreflight(argv) {
  const opts = parseArgs(argv)
  const chain = verifySageMigrationChain()
  let apply = null

  if (opts.mode === 'apply') {
    if (chain.result !== 'CHAIN_OK') {
      throw errorCode('CHAIN_MUST_VERIFY_BEFORE_APPLY')
    }
    apply = await applySageMigrationChain(opts.url, { allowProdHost: opts.allowProdHost })
  }

  const receipt = {
    schemaVersion: 1,
    kind: 'SAGE_B005_MIGRATION_PREFLIGHT',
    observedAt: new Date().toISOString(),
    mode: opts.mode,
    chain,
    apply,
    requiredTail: B005_REQUIRED_TAIL,
    result:
      opts.mode === 'verify'
        ? chain.result
        : opts.mode === 'apply'
          ? chain.result === 'CHAIN_OK' && apply?.result === 'APPLY_OK'
            ? 'PREFLIGHT_APPLY_OK'
            : 'PREFLIGHT_FAIL'
          : chain.result === 'CHAIN_OK'
            ? 'RECEIPT_READY'
            : 'RECEIPT_FAIL',
    b005Closure: 'NOT_PROVEN',
    unsupportedClaims: [
      'Azure staging image digest not verified',
      'Authenticated institutional HTTP not verified',
      'Isolated staging RG deploy not verified',
    ],
  }

  if (opts.out) {
    await mkdir(dirname(opts.out), { recursive: true })
    await writeFile(opts.out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    process.stdout.write(`${receipt.result}: receipt ${opts.out}\n`)
  } else {
    process.stdout.write(JSON.stringify(receipt, null, 2) + '\n')
  }

  if (receipt.result === 'CHAIN_FAIL' || receipt.result === 'PREFLIGHT_FAIL' || receipt.result === 'RECEIPT_FAIL') {
    process.exitCode = 1
  }
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrationPreflight(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof Error && error.message.startsWith('SAGE_B005_MIGRATION_PREFLIGHT:')
        ? error.message
        : 'SAGE_B005_MIGRATION_PREFLIGHT: UNEXPECTED_ERROR'
    process.stderr.write(code + '\n')
    process.exitCode = 1
  })
}
