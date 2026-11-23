#!/usr/bin/env node
/**
 * SAGE B-005 authenticated HTTP smoke harness.
 *
 * Fail-closed without credentials. Never invents session cookies.
 * Anonymous probes alone cannot pass this harness.
 *
 * Required env (when executing against staging):
 *   SAGE_B005_BASE_URL          https://staging-admin.nzilaventures.com
 *   SAGE_B005_SESSION_COOKIE    session cookie value for a fictional test identity
 *   SAGE_B005_EXPECTED_SHA      40-char commit expected in /api/health
 *
 * Usage:
 *   node tooling/scripts/sage-b005-authenticated-http-smoke.mjs --receipt path.json
 *   node tooling/scripts/sage-b005-authenticated-http-smoke.mjs --dry-run --receipt path.json
 *
 * --dry-run validates argument/env shape and writes NOT_PROVEN without network I/O.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const ALLOWED_HOST = 'staging-admin.nzilaventures.com'
const SHA = /^[a-f0-9]{40}$/i

const ROUTES = [
  { label: 'SAGE_PAGE', path: '/sage', method: 'GET' },
  { label: 'SAGE_WORKSPACES_API', path: '/api/sage/workspaces', method: 'GET' },
]

function errorCode(message) {
  return new Error('SAGE_B005_AUTH_SMOKE: ' + message)
}

export function assertStagingBase(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw errorCode('INVALID_BASE_URL')
  }
  if (
    u.protocol !== 'https:' ||
    u.hostname.toLowerCase() !== ALLOWED_HOST ||
    u.port ||
    u.username ||
    u.password ||
    u.pathname !== '/' ||
    u.search ||
    u.hash
  ) {
    throw errorCode('NON_STAGING_ORIGIN_REFUSED')
  }
  return u.origin
}

function parseArgs(argv) {
  const opts = { receipt: null, dryRun: false }
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--receipt') opts.receipt = args[++i]
    else if (a === '--dry-run') opts.dryRun = true
    else throw errorCode(`UNKNOWN_ARGUMENT:${a}`)
  }
  if (!opts.receipt) throw errorCode('RECEIPT_REQUIRED')
  return opts
}

export function readCredentialEnv(env = process.env) {
  const base = env.SAGE_B005_BASE_URL ?? null
  const cookie = env.SAGE_B005_SESSION_COOKIE ?? null
  const expectedSha = env.SAGE_B005_EXPECTED_SHA ?? null
  return { base, cookie, expectedSha }
}

export function credentialsPresent(creds) {
  return Boolean(
    creds.base &&
      creds.cookie &&
      creds.cookie.length >= 16 &&
      creds.expectedSha &&
      SHA.test(creds.expectedSha),
  )
}

async function requestOnce(fetchImpl, url, cookie) {
  try {
    return await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/json, text/html',
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return null
  }
}

export async function runAuthenticatedSmoke({
  creds,
  dryRun = false,
  fetchImpl = fetch,
  observedAt = new Date().toISOString(),
}) {
  if (!credentialsPresent(creds)) {
    return {
      schemaVersion: 1,
      kind: 'SAGE_B005_AUTHENTICATED_HTTP_SMOKE',
      observedAt,
      result: 'CREDENTIALS_ABSENT',
      b005Closure: 'NOT_PROVEN',
      routes: [],
      unsupportedClaims: [
        'No SAGE_B005_SESSION_COOKIE / BASE_URL / EXPECTED_SHA — authenticated journey NOT_PROVEN',
      ],
    }
  }

  const origin = assertStagingBase(creds.base)
  if (dryRun) {
    return {
      schemaVersion: 1,
      kind: 'SAGE_B005_AUTHENTICATED_HTTP_SMOKE',
      observedAt,
      target: origin,
      expectedSha: creds.expectedSha,
      result: 'DRY_RUN_READY',
      b005Closure: 'NOT_PROVEN',
      routes: ROUTES.map((r) => ({ route: r.label, status: 'NOT_EXECUTED' })),
      unsupportedClaims: ['Dry-run only — no authenticated HTTP executed'],
    }
  }

  const healthRes = await requestOnce(fetchImpl, origin + '/api/health', creds.cookie)
  let healthCommit = null
  let healthOk = false
  if (healthRes?.status === 200) {
    try {
      const body = await healthRes.json()
      healthCommit = typeof body?.buildInfo?.commit === 'string' ? body.buildInfo.commit : null
      healthOk = healthCommit === creds.expectedSha && body?.status === 'ok'
    } catch {
      healthOk = false
    }
  }

  const routes = []
  for (const route of ROUTES) {
    const res = await requestOnce(fetchImpl, origin + route.path, creds.cookie)
    const code = res?.status ?? null
    // Authenticated success is 200. Login redirect / 401 means session invalid.
    const admitted = code === 200
    const refusedAuth = code === 401 || code === 403 || (code && code >= 300 && code < 400)
    routes.push({
      route: route.label,
      code,
      admitted,
      refusedAuth,
    })
  }

  const allAdmitted = routes.every((r) => r.admitted)
  const result =
    healthOk && allAdmitted
      ? 'AUTHENTICATED_SMOKE_PASS'
      : 'AUTHENTICATED_SMOKE_FAIL'

  return {
    schemaVersion: 1,
    kind: 'SAGE_B005_AUTHENTICATED_HTTP_SMOKE',
    observedAt,
    target: origin,
    expectedSha: creds.expectedSha,
    health: { ok: healthOk, commit: healthCommit },
    routes,
    result,
    b005Closure: 'NOT_PROVEN',
    unsupportedClaims: [
      'Institutional mandate mutation not exercised in this smoke',
      'Azure image digest not verified here',
      'Tenant isolation SQL not re-proven by HTTP alone',
    ],
  }
}

export async function runAuthSmokeCli(argv) {
  const opts = parseArgs(argv)
  const creds = readCredentialEnv()
  const receipt = await runAuthenticatedSmoke({ creds, dryRun: opts.dryRun })
  await mkdir(dirname(opts.receipt), { recursive: true })
  await writeFile(opts.receipt, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${receipt.result}: receipt ${opts.receipt}\n`)
  if (receipt.result === 'AUTHENTICATED_SMOKE_FAIL') process.exitCode = 1
  // CREDENTIALS_ABSENT is an honest NOT_PROVEN, not a script failure.
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAuthSmokeCli(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof Error && error.message.startsWith('SAGE_B005_AUTH_SMOKE:')
        ? error.message
        : 'SAGE_B005_AUTH_SMOKE: UNEXPECTED_ERROR'
    process.stderr.write(code + '\n')
    process.exitCode = 1
  })
}
