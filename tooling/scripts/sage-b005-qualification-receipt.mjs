#!/usr/bin/env node
/**
 * Compose a machine-readable SAGE B-005 qualification receipt.
 *
 * Aggregates offline evidence sections. Each section may be SOURCE_IMPLEMENTED,
 * LOCAL_TESTED, CI_VERIFIED, STAGING_VERIFIED, NOT_PROVEN, BLOCKED, or NO_GO.
 * Top-level b005Closure remains NOT_PROVEN until every required staging proof
 * is present — this tool never elevates closure from incomplete offline work.
 *
 * Usage:
 *   node tooling/scripts/sage-b005-qualification-receipt.mjs \
 *     --git-sha <40-hex> \
 *     --out reports/proof-runs/sage-b005-qualification.json \
 *     [--migration-receipt path] \
 *     [--http-preflight path] \
 *     [--auth-smoke path] \
 *     [--restore-harness path] \
 *     [--expected-image-digest sha256:…]
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { verifySageMigrationChain, REPO_ROOT } from './lib/sage-migration-chain.mjs'

const SHA = /^[a-f0-9]{40}$/i
const STATES = new Set([
  'SOURCE_IMPLEMENTED',
  'LOCAL_TESTED',
  'CI_VERIFIED',
  'STAGING_VERIFIED',
  'NOT_PROVEN',
  'BLOCKED',
  'NO_GO',
])

function errorCode(message) {
  return new Error('SAGE_B005_QUALIFICATION_RECEIPT: ' + message)
}

async function readJsonIfPresent(path) {
  if (!path) return null
  try {
    await access(path, constants.R_OK)
  } catch {
    return null
  }
  return JSON.parse(await readFile(path, 'utf8'))
}

function parseArgs(argv) {
  const opts = {
    gitSha: null,
    out: null,
    migrationReceipt: null,
    httpPreflight: null,
    authSmoke: null,
    restoreHarness: null,
    expectedImageDigest: null,
  }
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]
    const value = args[i + 1]
    if (!value) throw errorCode('ARGUMENTS_INVALID')
    if (name === '--git-sha') opts.gitSha = value
    else if (name === '--out') opts.out = value
    else if (name === '--migration-receipt') opts.migrationReceipt = value
    else if (name === '--http-preflight') opts.httpPreflight = value
    else if (name === '--auth-smoke') opts.authSmoke = value
    else if (name === '--restore-harness') opts.restoreHarness = value
    else if (name === '--expected-image-digest') opts.expectedImageDigest = value
    else throw errorCode(`UNKNOWN_ARGUMENT:${name}`)
  }
  if (!opts.gitSha || !SHA.test(opts.gitSha)) throw errorCode('GIT_SHA_REQUIRED')
  if (!opts.out) throw errorCode('OUT_REQUIRED')
  return opts
}

function section(id, state, evidence, notes = []) {
  if (!STATES.has(state)) throw errorCode(`INVALID_STATE:${state}`)
  return { id, state, evidence, notes }
}

export function composeQualificationReceipt({
  gitSha,
  chain,
  migrationReceipt,
  httpPreflight,
  authSmoke,
  restoreHarness,
  expectedImageDigest,
  observedAt = new Date().toISOString(),
}) {
  const sections = [
    section(
      'build.provenance',
      expectedImageDigest ? 'SOURCE_IMPLEMENTED' : 'NOT_PROVEN',
      {
        gitSha,
        expectedImageDigest: expectedImageDigest ?? null,
        azureRevision: null,
      },
      expectedImageDigest
        ? ['Image digest recorded as expectation only; Azure revision still NOT_PROVEN']
        : ['No image digest supplied'],
    ),
    section(
      'database.migrations',
      chain.result === 'CHAIN_OK' ? 'LOCAL_TESTED' : 'BLOCKED',
      {
        chainResult: chain.result,
        fileCount: chain.fileCount,
        lockedThrough: chain.lockedThrough,
        lockedThroughMeetsB005: chain.lockedThroughMeetsB005,
        applyResult: migrationReceipt?.apply?.result ?? null,
      },
      ['Checksum lock verified offline; staging apply still required for STAGING_VERIFIED'],
    ),
    section(
      'database.rls_roles',
      'SOURCE_IMPLEMENTED',
      {
        roles: ['sage_app', 'sage_internal_exec', 'sage_recipient'],
        proofPaths: [
          'packages/sage-core/src/records-postgres-server.test.ts',
          'packages/sage-core/src/institutional-mandate-enforcement.pglite.test.ts',
        ],
      },
      ['CI / local PG proofs exist; staging RLS inventory still NOT_PROVEN'],
    ),
    section(
      'bootstrap.fixtures',
      'SOURCE_IMPLEMENTED',
      {
        package: 'fixtures/sage-b005-institutional/',
        journeys: ['P01', 'R01', 'S01', 'T01'],
      },
      ['Fictional fixtures only; not a staging seed attestation'],
    ),
    section(
      'http.anonymous_preflight',
      httpPreflight?.result === 'ANONYMOUS_BOUNDARY_PASS' ? 'LOCAL_TESTED' : 'NOT_PROVEN',
      { receiptKind: httpPreflight?.kind ?? null, result: httpPreflight?.result ?? null },
      ['Anonymous boundary ≠ authenticated institutional proof'],
    ),
    section(
      'http.authenticated_smoke',
      authSmoke?.result === 'AUTHENTICATED_SMOKE_PASS' ? 'LOCAL_TESTED' : 'NOT_PROVEN',
      { receiptKind: authSmoke?.kind ?? null, result: authSmoke?.result ?? null },
      ['Requires staging credentials; absent ⇒ NOT_PROVEN'],
    ),
    section(
      'ops.restore_continuity',
      restoreHarness?.result === 'RESTORE_HARNESS_PASS' ? 'LOCAL_TESTED' : 'NOT_PROVEN',
      { receiptKind: restoreHarness?.kind ?? null, result: restoreHarness?.result ?? null },
      ['Local harness only; Azure PITR still NOT_PROVEN'],
    ),
    section(
      'ops.telemetry_incident',
      'NOT_PROVEN',
      { alertReceivers: null, drillId: null },
      ['Live collector / incident drill external'],
    ),
    section(
      'product.adversarial_journeys',
      'LOCAL_TESTED',
      {
        journeys: {
          P01: 'LOCAL_TESTED',
          R01: 'LOCAL_TESTED',
          S01: 'LOCAL_TESTED',
          T01: 'LOCAL_TESTED',
        },
      },
      ['Server/SQL local proofs; staging HTTP journeys NOT_PROVEN'],
    ),
    section('civic.c1', 'NO_GO', { authorization: 'AWAITING_OWNER_GRANT' }, [
      'C1 synthetic grant not issued; CIVIC_PRODUCT_GO_LIVE = NO_GO',
    ]),
  ]

  const stagingReady = sections.every((s) =>
    ['STAGING_VERIFIED', 'CI_VERIFIED'].includes(s.state) ||
    (s.id === 'civic.c1' && s.state === 'NO_GO'),
  )

  return {
    schemaVersion: 1,
    kind: 'SAGE_B005_QUALIFICATION_RECEIPT',
    observedAt,
    repository: 'anungis437/nzila-os',
    gitSha,
    sections,
    result: stagingReady ? 'QUALIFICATION_COMPLETE' : 'QUALIFICATION_INCOMPLETE',
    b005Closure: 'NOT_PROVEN',
    remainingExternalDecisions: [
      'Azure staging write / deploy authorization',
      'Authenticated staging HTTP with test identities',
      'Human merge authorization for integration PR',
      'C1 owner grant (separate from B-005)',
    ],
  }
}

export async function runQualificationReceipt(argv) {
  const opts = parseArgs(argv)
  const chain = verifySageMigrationChain()
  const migrationReceipt = await readJsonIfPresent(opts.migrationReceipt)
  const httpPreflight = await readJsonIfPresent(opts.httpPreflight)
  const authSmoke = await readJsonIfPresent(opts.authSmoke)
  const restoreHarness = await readJsonIfPresent(opts.restoreHarness)

  const receipt = composeQualificationReceipt({
    gitSha: opts.gitSha,
    chain,
    migrationReceipt,
    httpPreflight,
    authSmoke,
    restoreHarness,
    expectedImageDigest: opts.expectedImageDigest,
  })

  await mkdir(dirname(opts.out), { recursive: true })
  await writeFile(opts.out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${receipt.result}: b005Closure=${receipt.b005Closure} → ${opts.out}\n`)
  return receipt
}

export function resolveHeadSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runQualificationReceipt(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof Error && error.message.startsWith('SAGE_B005_QUALIFICATION_RECEIPT:')
        ? error.message
        : 'SAGE_B005_QUALIFICATION_RECEIPT: UNEXPECTED_ERROR'
    process.stderr.write(code + '\n')
    process.exitCode = 1
  })
}
