#!/usr/bin/env node
/**
 * SAGE B-005 read-only HTTP preflight.
 *
 * Does NOT deploy, authenticate, mutate a database, create synthetic data,
 * or close B-005. It verifies that a *specific* staging commit is reachable
 * and that SAGE route handlers appear to exist while anonymous requests
 * remain denied. Full B-005 still requires image digest, migration/RLS
 * receipts, authenticated user journey and independent operational proof.
 *
 * Usage:
 *   node tooling/scripts/sage-staging-http-preflight.mjs \
 *     --base https://staging-admin.nzilaventures.com \
 *     --expected-sha <40-digit-commit> \
 *     --receipt reports/proof-runs/sage-b005-http-preflight.json
 *
 * No automatic fallback to production, no secret headers, no auth cookies,
 * no cross-host redirect following, and no success-by-HTTP-200 alone.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const ALLOWED_HOST = 'staging-admin.nzilaventures.com'
const SHA = /^[a-f0-9]{40}$/i
const ROUTES = [
  { label: 'SAGE_PAGE', path: '/sage' },
  { label: 'SAGE_WORKSPACES_API', path: '/api/sage/workspaces' },
]

function errorCode(message) {
  return new Error('SAGE_STAGING_HTTP_PREFLIGHT: ' + message)
}

export function assertSageStagingOrigin(raw) {
  let u
  try { u = new URL(raw) } catch { throw errorCode('INVALID_STAGING_ORIGIN') }
  if (
    u.protocol !== 'https:' ||
    u.hostname.toLowerCase() !== ALLOWED_HOST ||
    u.port ||
    u.username ||
    u.password ||
    u.pathname !== '/' ||
    u.search ||
    u.hash
  ) throw errorCode('NON_STAGING_ORIGIN_REFUSED')
  return u.origin
}

export function routeIsProtectedButPresent(status, location) {
  if (status === 401 || status === 403) return true
  if (![302, 303, 307, 308].includes(status)) return false
  // Redirect to a login page is a protective first response, but NEVER
  // follow it, so a reachable login page cannot disguise a missing SAGE route.
  return typeof location === 'string' && /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?sign-in(?:[/?#]|$)/.test(location)
}

async function requestOnce(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    return response
  } catch {
    return null
  }
}

export async function inspectSageStagingHttp({
  base,
  expectedSha,
  fetchImpl = fetch,
  observedAt = new Date().toISOString(),
}) {
  const origin = assertSageStagingOrigin(base)
  if (typeof expectedSha !== 'string' || !SHA.test(expectedSha)) {
    throw errorCode('EXPECTED_FULL_COMMIT_SHA_REQUIRED')
  }
  const healthResponse = await requestOnce(fetchImpl, origin + '/api/health')
  const health = {
    code: healthResponse?.status ?? null,
    contentType: healthResponse?.headers.get('content-type')?.split(';')[0] ?? null,
    status: null,
    app: null,
    db: null,
    commit: null,
    passed: false,
  }
  if (healthResponse?.status === 200 && health.contentType === 'application/json') {
    let parsed = null
    try { parsed = await healthResponse.json() } catch { /* invalid JSON means fail */ }
    health.status = typeof parsed?.status === 'string' ? parsed.status : null
    health.app = typeof parsed?.app === 'string' ? parsed.app : null
    health.db = typeof parsed?.checks?.db === 'string' ? parsed.checks.db : null
    health.commit = typeof parsed?.buildInfo?.commit === 'string' ? parsed.buildInfo.commit : null
    health.passed = health.status === 'ok' &&
      health.app === '@nzila/platform-admin' &&
      health.db === 'ok' &&
      health.commit === expectedSha
  }

  const routes = []
  for (const route of ROUTES) {
    const res = await requestOnce(fetchImpl, origin + route.path)
    const code = res?.status ?? null
    const location = res?.headers.get('location') ?? null
    routes.push({
      route: route.label,
      code,
      // No response payload saved: avoid accidental disclosing internal data.
      protected: routeIsProtectedButPresent(code, location),
      // We do not persist location targets (could contain query state).
    })
  }
  const httpPreflightPassed = health.passed && routes.every((r) => r.protected)

  return {
    schemaVersion: 1,
    kind: 'SAGE_STAGING_HTTP_PREFLIGHT',
    observedAt,
    target: origin,
    expectedSha,
    health,
    routes,
    result: httpPreflightPassed ? 'HTTP_PREFLIGHT_PASS' : 'HTTP_PREFLIGHT_FAIL',
    b005Closure: 'NOT_PROVEN',
    unsupportedClaims: [
      'migration and sage table inventory not verified',
      'isolated PostgreSQL RLS not verified',
      'authenticated route journey not verified',
      'image digest and Azure revision not verified',
      'incident alerts, backup restoration and accessibility not verified',
    ],
  }
}

function argsToRecord(argv) {
  const pairs = {}
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i]
    if (!['--base', '--expected-sha', '--receipt'].includes(name) || !argv[i + 1]) {
      throw errorCode('ARGUMENTS_INVALID')
    }
    if (Object.prototype.hasOwnProperty.call(pairs, name)) throw errorCode('DUPLICATE_ARGUMENT')
    pairs[name] = argv[i + 1]
  }
  if (!pairs['--base'] || !pairs['--expected-sha'] || !pairs['--receipt']) {
    throw errorCode('ARGUMENTS_REQUIRED')
  }
  return pairs
}

export async function runSageStagingHttpPreflight(argv) {
  const args = argsToRecord(argv)
  const result = await inspectSageStagingHttp({
    base: args['--base'],
    expectedSha: args['--expected-sha'],
  })
  const receiptPath = args['--receipt']
  await mkdir(dirname(receiptPath), { recursive: true })
  // Never silently overwrite previous evidence; each execution is a new record.
  await writeFile(receiptPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stdout.write(result.result + ': receipt ' + receiptPath + '\n')
  if (result.result !== 'HTTP_PREFLIGHT_PASS') process.exitCode = 1
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSageStagingHttpPreflight(process.argv.slice(2)).catch((error) => {
    const code = error instanceof Error && error.message.startsWith('SAGE_STAGING_HTTP_PREFLIGHT:')
      ? error.message
      : 'SAGE_STAGING_HTTP_PREFLIGHT: UNEXPECTED_ERROR'
    process.stderr.write(code + '\n')
    process.exitCode = 1
  })
}
