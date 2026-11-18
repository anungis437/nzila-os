import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { assertCurrentSourceCommitments, folder, hash, root, type V2Plan } from './source'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { openLocalVaultFixture } from './local-vault-fixture'
import { runNextHttpSmoke, seedNextHttpSmoke, type HttpObservation } from './next-http-smoke'
import { browserProofPassed, runBrowserAcceptance } from './browser-acceptance'
import { AUTHENTICATED_CASEWORK_PROFILE } from './authenticated-casework-load'
import { closeAuthClients } from '../../../../packages/db/src/auth-client'
import {
  classifyConnectionEnvironment,
  collectConnectionEnvironmentSurface,
} from './connection-environment-surface'

const excluded = new Set(['node_modules', '.git', '.next', '.turbo', '.venv', '__pycache__'])
export function safeSnapshotEntry(file: string) {
  const name = path.basename(file)
  return !excluded.has(name) && !/^\.env(?:\.|$)/.test(name) && !name.endsWith('.tsbuildinfo')
}

export function nextResourceProfile(value?: string) {
  const maxOldSpaceMb = value === undefined ? 4096 : Number(value)
  assert.ok(value === undefined || /^\d+$/.test(value), 'Explicit Next heap must be an integer in MB')
  assert.ok(Number.isInteger(maxOldSpaceMb) && maxOldSpaceMb >= 1024 && maxOldSpaceMb <= 8192,
    'Explicit Next heap must be between 1024 and 8192 MB')
  return { maxOldSpaceMb, explicitOverride: value !== undefined,
    diskAdmissionMinimumBytes: 2 * 1024 ** 3, diskCancelBelowBytes: 1024 ** 3, diskPollIntervalMs: 5000,
    scope: 'Per Node process; this is not an operating-system or whole-host memory limit.' }
}

export function nextDiskAdmission(availableBytes: number, phase: 'ADMISSION' | 'BUILD') {
  assert.ok(Number.isFinite(availableBytes) && availableBytes >= 0, 'Available disk observation must be finite')
  const minimum = phase === 'ADMISSION' ? 2 * 1024 ** 3 : 1024 ** 3
  return { availableBytes, minimumBytes: minimum, allowed: availableBytes >= minimum }
}

function availableDiskBytes() {
  const space = statfsSync(root)
  return space.bavail * space.bsize
}

interface OwnedNextDatabaseUrls {
  runtimeUrl: string
  systemUrl: string
  authUrl?: string
  authSystemUrl?: string
}

export function nextOutputSanitizer(urls: OwnedNextDatabaseUrls, additionalSecrets: string[]) {
  const secrets = [...new Set([
    ...additionalSecrets,
    ...[urls.runtimeUrl, urls.systemUrl, urls.authUrl, urls.authSystemUrl]
      .filter((url): url is string => Boolean(url))
      .flatMap((url) => {
        const encoded = new URL(url).password
        return [encoded, decodeURIComponent(encoded)]
      }),
  ].filter(Boolean))]
  return {
    redact: (value: string) => secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value),
    countPersistedSecrets: (value: string) => secrets.reduce((count, secret) => count + Number(value.includes(secret)), 0),
  }
}

export function syntheticNextEnvironment(
  urls: OwnedNextDatabaseUrls,
  port: number,
  boundary: string,
  statePath = path.join(tmpdir(), `ue-v2-next-state-${randomUUID()}`),
  resources = nextResourceProfile(),
): NodeJS.ProcessEnv {
  assert.ok(urls.authUrl, 'Dedicated auth fixture required')
  assert.ok(urls.authSystemUrl, 'Dedicated auth-system fixture required')
  const runtime = new URL(urls.runtimeUrl)
  const authSystemUsername = decodeURIComponent(new URL(urls.authSystemUrl).username)
  assert.ok(authSystemUsername, 'Dedicated auth-system login required')
  for (const value of [urls.runtimeUrl, urls.systemUrl, urls.authUrl])
    assert.notEqual(decodeURIComponent(new URL(value).username), authSystemUsername,
      'Auth-system login cannot reuse ordinary auth or business credentials')
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' }
  // No PATH, NODE_OPTIONS, proxies, provider credentials or dotenv values inherited.
  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC'])
    if (process.env[key]) env[key] = process.env[key]
  for (const value of [urls.runtimeUrl, urls.systemUrl, urls.authUrl, urls.authSystemUrl]) {
    const url = new URL(value)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.protocol, 'postgresql:')
    assert.equal(url.port, runtime.port, 'Database connection must use the owned fixture port')
    assert.equal(url.pathname, runtime.pathname, 'Database connection must use the owned fixture database')
  }
  Object.assign(env, {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    OTEL_SDK_DISABLED: 'true',
    NODE_OPTIONS: `--max-old-space-size=${resources.maxOldSpaceMb} --require ${JSON.stringify(boundary)}`,
    UE_V2_LOCAL_PORTS: `${new URL(urls.runtimeUrl).port},${port}`,
    UE_V2_NETWORK_AUDIT: '1',
    DATABASE_URL: urls.runtimeUrl,
    SYSTEM_DATABASE_URL: urls.systemUrl,
    AUTH_DATABASE_URL: urls.authUrl,
    AUTH_SYSTEM_DATABASE_URL: urls.authSystemUrl,
    DATABASE_TYPE: 'postgresql',
    AUTH_SECRET: randomBytes(48).toString('hex'),
    AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    VOTING_SECRET: randomBytes(48).toString('hex'),
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    AUTH_URL: `http://127.0.0.1:${port}`,
    AUTH_TRUST_HOST: 'true',
    UE_ENVIRONMENT: 'test',
    UE_FEATURE_PROFILE: 'internal',
    UE_CANONICAL_BOOTSTRAP_V2: '1',
    CRON_SECRET: 'ue-v2-cron-secret',
    EMAIL_PROVIDER: 'console',
    DB_POOL_MAX: '2',
    DB_SSL: 'false',
    HOME: statePath,
    USERPROFILE: statePath,
    APPDATA: statePath,
    LOCALAPPDATA: statePath,
    TEMP: statePath,
    TMP: statePath,
    TMPDIR: statePath,
  })
  return env
}

export function observedNetworkEvents(output: string) {
  return [...output.matchAll(/^UE_V2_NETWORK_AUDIT:(\{[^\r\n]*\})$/gm)].map((match) => {
    const event: unknown = JSON.parse(match[1])
    assert.ok(event && typeof event === 'object')
    const entry = event as Record<string, unknown>
    assert.equal(typeof entry.allowed, 'boolean')
    assert.equal(typeof entry.targetDigest, 'string')
    assert.match(entry.targetDigest as string, /^[a-f0-9]{64}$/)
    return entry
  })
}

export function environmentClassifications(env: NodeJS.ProcessEnv) {
  const categories = {
    DATABASE: [
      'DATABASE_URL',
      'SYSTEM_DATABASE_URL',
      'AUTH_DATABASE_URL',
      'AUTH_SYSTEM_DATABASE_URL',
    ],
    CACHE: ['REDIS_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    TELEMETRY: ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN', 'OTEL_EXPORTER_OTLP_ENDPOINT'],
    STORAGE: [
      'AZURE_KEY_VAULT_URL',
      'IDENTITY_ENDPOINT',
      'IDENTITY_HEADER',
      'NODE_EXTRA_CA_CERTS',
      'AZURE_STORAGE_CONNECTION_STRING',
      'BLOB_CONNECTION_STRING',
      'KEY_VAULT_URI',
      'AWS_ACCESS_KEY_ID',
    ],
    MAIL: ['SMTP_HOST', 'RESEND_API_KEY', 'SENDGRID_API_KEY'],
    PAYMENT: ['STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_SECRET'],
    EXTERNAL_API: [
      'AZURE_AD_CLIENT_ID',
      'AZURE_AD_CLIENT_SECRET',
      'AI_CORE_URL',
      'ML_CORE_URL',
      'OPENAI_API_KEY',
    ],
  }
  return Object.entries(categories).flatMap(([category, keys]) =>
    keys.map((key) => {
      const value = env[key]
      if (!value) return { key, category, classification: 'ABSENT' }
      if (key === 'IDENTITY_HEADER') {
        assert.ok(env.IDENTITY_ENDPOINT, 'Synthetic identity header requires owned endpoint')
        assert.equal(new URL(env.IDENTITY_ENDPOINT).hostname, '127.0.0.1')
        return { key, category, classification: 'OWNED_SYNTHETIC_AUTHENTICATION_SECRET' }
      }
      if (key === 'NODE_EXTRA_CA_CERTS') {
        assert.equal(value, path.join(env.HOME!, 'owned-vault-public-ca.pem'))
        return { key, category, classification: 'OWNED_PUBLIC_CA_CERTIFICATE' }
      }
      const url = new URL(value)
      assert.ok(
        url.hostname === '127.0.0.1' ||
          (key === 'AZURE_KEY_VAULT_URL' &&
            env.UE_V2_LOCAL_VAULT_ALIAS === '1' &&
            url.hostname === 'vault.ue-v2.localhost' &&
            url.protocol === 'https:' &&
            env.UE_V2_LOCAL_PORTS?.split(',').includes(url.port)),
        `External target: ${key}`,
      )
      return { key, category, classification: 'OWNED_LOOPBACK_FIXTURE' }
    }),
  )
}

const sourcePaths = ['apps/union-eyes', 'packages', 'tooling', 'patches', 'package.json',
  'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', '.github/workflows/ue-http-runtime.yml',
  'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json']
function trackedSourceChanges() {
  return execFileSync('git', ['diff', 'HEAD', '--name-only', '--', ...sourcePaths],
    { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
}
function proofObject(value: unknown, label: string): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`)
  return value as Record<string, unknown>
}
function proofArray(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label}: array required`)
  return value
}
function proofNumber(value: unknown, label: string, integer = false): number {
  assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
    (!integer || Number.isSafeInteger(value)), `${label}: measured nonnegative number required`)
  return value
}
function proofHash(value: unknown, label: string) {
  assert.ok(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), `${label}: SHA-256 required`)
}
export interface NextEngineeringExpectation {
  executionId: string
  sourceSha: string
  sourcePlanDigest: string
  sourcePlanFileSha256: string
  boundarySourceDigest: string
}

/** Existing engineering components only. This never establishes overall acceptance or staging GO. */
export function verifyNextEngineeringComponents(raw: unknown, rawExit: unknown, expected: NextEngineeringExpectation) {
  const result = proofObject(raw, 'runtime receipt'), exit = proofObject(rawExit, 'raw CLI exit')
  assert.match(expected.sourceSha, /^[a-f0-9]{40}$/)
  assert.match(expected.executionId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  assert.equal(exit.code, 1, 'Default CLI must preserve its actual acceptance-unproven exit1')
  assert.equal(exit.signal, null, 'Cancelled runtime cannot qualify')
  assert.equal(exit.launchError, null, 'Failed runtime launch cannot qualify')
  assert.equal(result.contractVersion, '2.0')
  assert.equal(result.status, 'HTTP_SMOKE_PASS_FINAL_ACCEPTANCE_NOT_PROVEN')
  assert.equal(result.executionId, expected.executionId, 'Stale execution receipt')
  assert.equal(result.sourceSha, expected.sourceSha, 'Candidate source mismatch')
  for (const key of ['sourcePlanDigest', 'sourcePlanFileSha256', 'boundarySourceDigest'] as const) {
    proofHash(expected[key], key)
    assert.equal(result[key], expected[key], `${key}: source mismatch`)
  }
  assert.equal(result.sourceCommitmentsVerified, true)
  assert.deepEqual(result.trackedSourceChangesAtStart, [])
  assert.deepEqual(result.trackedSourceChangesAtEnd, [])
  assert.deepEqual(result.requestFlags, { browserAcceptance: true, authenticatedCaseworkLoad: true })
  for (const key of ['sourceSnapshotDigest', 'buildArtifactDigest']) proofHash(result[key], key)
  assert.equal(result.legacyPredevInvoked, false)
  assert.deepEqual(result.mandatorySecurityBypasses, [])
  assert.equal(result.rawSyntheticSecretsPersisted, 0)
  assert.ok(!('error' in result), 'Runtime execution reported an error')
  assert.equal(result.nextBuild, 'PASS')
  assert.equal(result.buildExitCode, 0)
  assert.equal(result.nextRuntimeReady, 'PASS')
  assert.deepEqual(result.initialHttpProbe, { path: '/api/version', status: 200 })
  assert.equal(result.serverRuntimeSmoke, 'PASS')
  const disk = proofObject(result.buildDiskWatchdog, 'build disk watchdog')
  assert.equal(disk.status, 'BUILD_EXITED')
  assert.equal(disk.cancellationReason, null)
  assert.ok(proofNumber(disk.minimumObservedAvailableBytes, 'disk measurement') >= 1024 ** 3)
  const http = proofObject(result.httpSmoke, 'HTTP smoke')
  assert.equal(http.status, 'PASS')
  assert.equal(http.ordinaryWrite, 'PERSISTED_RELOADED_CANONICAL_ACTOR_AND_ORGANIZATION')
  assert.equal(http.systemWrite, 'AUTHORIZED_AND_PERSISTED_ORDINARY_CALLER_DENIED')
  const observations = proofArray(result.httpObservations, 'HTTP observations')
  assert.ok(observations.length > 0, 'Actual HTTP observations required')
  for (const value of observations) {
    const row = proofObject(value, 'HTTP observation')
    const status = proofNumber(row.status, 'HTTP status', true)
    assert.ok(status >= 100 && (status < 500 || (status === 501 && row.name === 'legacy-documents-endpoint-not-implemented')))
  }
  const browser = proofObject(result.browserAcceptance, 'browser acceptance')
  assert.equal(browser.status, 'PASS')
  assert.equal(browser.engine, 'Chromium')
  assert.ok(typeof browser.engineVersion === 'string' && /^\d+\./.test(browser.engineVersion))
  assert.equal(browserProofPassed(browser as unknown as Parameters<typeof browserProofPassed>[0]), true,
    'All four actual browser profiles and every declared check must pass')
  const load = proofObject(result.authenticatedCaseworkLoad, 'authenticated load')
  assert.deepEqual(http.authenticatedCaseworkLoad, load)
  assert.equal(load.status, 'PASS')
  assert.deepEqual(load.profile, AUTHENTICATED_CASEWORK_PROFILE)
  assert.equal(load.profileDigest, hash(JSON.stringify(AUTHENTICATED_CASEWORK_PROFILE)))
  for (const key of ['sourceFixturesVerified', 'governedPrimaryAssignmentVerified', 'tenantDenialsBeforeAndAfter'])
    assert.equal(load[key], true)
  assert.equal(load.thresholdsRelaxed, false)
  assert.equal(load.credentialOrCaseContentPersisted, false)
  assert.deepEqual(load.roles, ['member', 'steward'])
  assert.equal(load.environment, 'OWNED_DISPOSABLE_LOCALHOST_NEXT_AND_CANONICAL_POSTGRESQL')
  const stages = proofArray(load.stages, 'load stages')
  assert.equal(stages.length, AUTHENTICATED_CASEWORK_PROFILE.stages.length)
  const warmup = { concurrency: 1, durationSeconds: AUTHENTICATED_CASEWORK_PROFILE.warmupSeconds,
    requestsPerSecond: AUTHENTICATED_CASEWORK_PROFILE.warmupRequestsPerSecond }
  let totalRequests = 0
  for (const [index, definition] of [warmup, ...AUTHENTICATED_CASEWORK_PROFILE.stages].entries()) {
    const stage = proofObject(index === 0 ? load.warmup : stages[index - 1], 'measured stage')
    assert.deepEqual({ concurrency: stage.concurrency, durationSeconds: stage.durationSeconds,
      requestsPerSecond: stage.requestsPerSecond }, definition, 'Full unchanged stage required')
    const scheduled = definition.durationSeconds * definition.requestsPerSecond
    assert.equal(stage.scheduledRequests, scheduled)
    const requests = proofNumber(stage.requests, 'measured requests', true)
    assert.ok(requests > 0)
    totalRequests += requests
    assert.equal(requests + proofNumber(stage.skipped, 'missed schedule slots', true), scheduled)
    assert.equal(stage.errors, 0)
    assert.equal(stage.errorRate, 0)
    assert.deepEqual(stage.failureMetadata, [])
    assert.equal(stage.scheduledThroughputRatio, requests / scheduled)
    const elapsed = proofNumber(stage.actualDurationSeconds, 'measured elapsed duration')
    // The last slot is scheduled one interval before the nominal end. Compare at timer resolution.
    assert.ok(Math.ceil(elapsed * 1000) >= Math.floor((definition.durationSeconds - 1 / definition.requestsPerSecond) * 1000))
    let previous = 0
    for (const key of ['p50Ms', 'p90Ms', 'p95Ms', 'p99Ms', 'maxMs']) {
      const measured = proofNumber(stage[key], key)
      assert.ok(measured >= previous, 'Percentiles must be ordered')
      previous = measured
    }
    proofHash(stage.sampleSha256, 'latency sample digest')
    const buckets = proofObject(stage.latencyBuckets, 'latency buckets')
    assert.deepEqual(Object.keys(buckets).sort(), ['<=100ms', '101-500ms', '501-1500ms', '>1500ms'].sort())
    assert.equal(Object.values(buckets).reduce<number>((sum, value) => sum + proofNumber(value, 'bucket samples', true), 0), requests)
    assert.equal(typeof stage.passed, 'boolean')
    if (index > 0) {
      assert.equal(stage.passed, true)
      assert.ok(requests / scheduled >= AUTHENTICATED_CASEWORK_PROFILE.minimumScheduledThroughputRatio)
      assert.ok((stage.p95Ms as number) <= AUTHENTICATED_CASEWORK_PROFILE.p95Ms)
      assert.ok((stage.p99Ms as number) <= AUTHENTICATED_CASEWORK_PROFILE.p99Ms)
    }
  }
  assert.ok(totalRequests <= AUTHENTICATED_CASEWORK_PROFILE.maxRequests)
  const ports = proofArray(result.ownedLocalPorts, 'owned local ports').map((port) => proofNumber(port, 'owned port', true))
  assert.ok(ports.length >= 2 && ports.every((port) => port > 1024 && port <= 65535))
  assert.equal(new Set(ports).size, ports.length)
  for (const key of ['buildBoundaryLoads', 'serverBoundaryLoads']) {
    const loads = proofArray(result[key], key)
    assert.ok(loads.length > 0, 'Actual child boundary loads required')
    for (const value of loads) {
      const row = proofObject(value, 'boundary load')
      assert.ok(proofNumber(row.pid, 'child pid', true) > 0)
      assert.equal(row.sourceDigest, expected.boundarySourceDigest)
      assert.deepEqual(proofArray(row.ownedPorts, 'boundary owned ports').slice().sort(), ports.slice().sort())
    }
  }
  const network = proofArray(result.networkObservations, 'network observations')
  assert.ok(network.length > 0, 'Actual transport observations required')
  for (const value of network) {
    const row = proofObject(value, 'transport row'), event = proofObject(row.event, 'transport observation')
    assert.ok(row.phase === 'BUILD' || row.phase === 'SERVER')
    assert.equal(event.allowed, true, 'Denied external attempts cannot qualify')
    assert.equal(event.targetClass, 'LOOPBACK')
    proofHash(event.targetDigest, 'observed target digest')
    if (event.transport === 'DNS_LOOKUP') assert.equal(event.port, null)
    else { assert.equal(event.transport, 'TCP'); assert.ok(ports.includes(proofNumber(event.port, 'observed port', true))) }
  }
  assert.equal(result.observedAllowedConnections, network.length)
  assert.equal(result.observedDeniedNetworkAttempts, 0)
  assert.equal(result.externalConnectionTargets, 0)
  const environment = proofArray(result.environment, 'child environment').map((row) => proofObject(row, 'environment classification'))
  for (const key of ['DATABASE_URL', 'SYSTEM_DATABASE_URL', 'AUTH_DATABASE_URL', 'AUTH_SYSTEM_DATABASE_URL'])
    assert.equal(environment.filter((row) => row.key === key && row.classification === 'OWNED_LOOPBACK_FIXTURE').length, 1)
  assert.ok(environment.every((row) => ['ABSENT', 'OWNED_LOOPBACK_FIXTURE', 'OWNED_PUBLIC_CA_CERTIFICATE',
    'OWNED_SYNTHETIC_AUTHENTICATION_SECRET'].includes(String(row.classification))))
  const cleanup = proofObject(result.cleanup, 'owned cleanup')
  for (const key of ['ownedServerExited', 'ownedAuthClientsClosed', 'ownedDatabaseRemoved', 'ownedSnapshotRemoved', 'ownedStateRemoved'])
    assert.equal(cleanup[key], true, `${key}: cleanup not confirmed`)
  assert.deepEqual(cleanup.errors, [])
  const vault = proofObject(result.vaultCleanup, 'owned vault cleanup')
  assert.equal(vault.ownedIdentityExited, true)
  assert.equal(vault.ownedVaultExited, true)
  const progress = proofObject(result.processProgressLog, 'sanitized raw progress')
  assert.equal(progress.path, `artifacts/ue-v2-next-progress-${expected.executionId}.log`)
  proofHash(progress.sha256, 'progress log digest')
  assert.equal(progress.phase, 'SERVER')
  return { status: 'PASS_REQUIRED_ENGINEERING_COMPONENTS', sourceSha: expected.sourceSha,
    executionId: expected.executionId, globalAcceptanceStatus: result.status, rawCliExitCode: exit.code,
    scope: 'Owned disposable V2 build, HTTP, four browser profiles and unchanged authenticated casework load only.',
    stagingAcceptance: 'NOT_PROVEN', productionDeployment: false }
}

const nextRawArtifactNames = ['runtime-exit.json', 'runtime-receipt.json', 'runtime-command.log', 'runtime-progress.log']
export function verifyNextEngineeringArtifacts(directory: string, expected: NextEngineeringExpectation) {
  const index = proofObject(JSON.parse(readFileSync(path.join(directory, 'raw-artifacts.json'), 'utf8')), 'raw artifact index')
  assert.equal(index.sourceSha, expected.sourceSha)
  assert.equal(index.executionId, expected.executionId)
  const artifacts = proofArray(index.artifacts, 'raw artifacts').map((value) => proofObject(value, 'raw artifact'))
  assert.deepEqual(artifacts.map((row) => row.file).sort(), nextRawArtifactNames.slice().sort())
  for (const artifact of artifacts) {
    assert.ok(typeof artifact.file === 'string' && nextRawArtifactNames.includes(artifact.file))
    const file = path.join(directory, artifact.file)
    assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), 'Owned raw artifact must be a regular file')
    const data = readFileSync(file)
    assert.equal(data.length, artifact.bytes, 'Raw artifact byte count changed')
    assert.equal(createHash('sha256').update(data).digest('hex'), artifact.sha256, 'Raw artifact bytes changed')
  }
  const receipt = proofObject(JSON.parse(readFileSync(path.join(directory, 'runtime-receipt.json'), 'utf8')), 'runtime receipt')
  assert.equal(proofObject(receipt.processProgressLog, 'progress').sha256,
    hash(readFileSync(path.join(directory, 'runtime-progress.log'), 'utf8')))
  return verifyNextEngineeringComponents(receipt,
    JSON.parse(readFileSync(path.join(directory, 'runtime-exit.json'), 'utf8')), expected)
}

async function unusedPort() {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

function digestTree(directory: string): string {
  const digest = createHash('sha256')
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(current, entry.name)
      if (entry.name === '.runtime-state' || entry.name === 'next-process.log') continue
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile()) {
        digest.update(path.relative(directory, file).replaceAll('\\', '/'))
        digest.update(readFileSync(file))
      }
    }
  }
  walk(directory)
  return digest.digest('hex')
}

function snapshotDotenvFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) return []
    if (entry.isDirectory()) return snapshotDotenvFiles(file)
    return /^\.env(?:\.|$)/.test(entry.name) ? [file] : []
  })
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise<void>((resolve) => child.once('close', () => resolve()))
  if (process.platform === 'win32' && child.pid) {
    execFileSync(
      path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$rootPid=${child.pid}; $all=Get-CimInstance Win32_Process; $owned=@($rootPid);
        for($i=0;$i -lt $owned.Count;$i++) { $owned+=@($all | Where-Object {$_.ParentProcessId -eq $owned[$i]} | Select-Object -ExpandProperty ProcessId) };
        foreach($ownedPid in ($owned | Sort-Object -Descending -Unique)) { Stop-Process -Id $ownedPid -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'pipe', timeout: 15000 },
    )
  } else {
    // launch() creates a dedicated process group owned by this harness.
    const signal = (name: NodeJS.Signals) => {
      try { if (child.pid) process.kill(-child.pid, name) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    signal('SIGTERM')
    const forced = setTimeout(() => signal('SIGKILL'), 10000)
    try { await exited } finally { clearTimeout(forced) }
    return
  }
  await exited
}

export async function runNextAcceptance() {
  const ownership = process.env.UE_V2_NEXT_EXECUTION_ID ?? randomUUID()
  assert.match(ownership, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  const authenticatedCaseworkLoad = process.env.UE_V2_AUTHENTICATED_CASEWORK_LOAD === '1'
  const browserAcceptance = process.env.UE_V2_BROWSER_ACCEPTANCE === '1'
  const snapshot = path.join(root, 'artifacts', `ue-v2-next-${ownership}`)
  const statePath = path.join(root, 'artifacts', `ue-v2-next-state-${ownership}`)
  const app = path.join(snapshot, 'apps', 'union-eyes')
  const result: Record<string, unknown> = {
    contractVersion: '2.0',
    executionId: ownership,
    requestFlags: { browserAcceptance, authenticatedCaseworkLoad },
    status: 'FAIL',
    externalConnectionTargets: 'NOT_OBSERVED',
    rawSyntheticSecretsPersisted: 'NOT_VERIFIED',
    legacyPredevInvoked: false,
    mandatorySecurityBypasses: [],
    browserAcceptance: { status: browserAcceptance ? 'PENDING' : 'UNEXECUTED', reason: browserAcceptance
      ? 'Requested Chromium desktop/mobile EN/FR journeys have no result before actual browser execution.'
      : 'UE_V2_BROWSER_ACCEPTANCE=1 was not enabled.' },
    authenticatedCaseworkLoad: {
      status: authenticatedCaseworkLoad ? 'PENDING' : 'UNEXECUTED',
      reason: authenticatedCaseworkLoad
        ? 'Requested full historical profile; no result before actual authenticated HTTP execution.'
        : 'UE_V2_AUTHENTICATED_CASEWORK_LOAD=1 was not enabled.',
    },
  }
  const planBytes = readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')
  const plan: V2Plan = JSON.parse(planBytes)
  result.sourcePlanDigest = hash(JSON.stringify(plan))
  result.sourcePlanFileSha256 = hash(planBytes)
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>> | undefined
  let vault: Awaited<ReturnType<typeof openLocalVaultFixture>> | undefined
  let child: ChildProcess | undefined
  let output = ''
  const networkObservations: { phase: string; event: Record<string, unknown> }[] = []
  let phase = 'BUILD'
  let redact = (value: string) => value
  let countPersistedSecrets: ((value: string) => number) | undefined
  try {
    result.sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    result.trackedSourceChangesAtStart = trackedSourceChanges()
    assertCurrentSourceCommitments(plan)
    result.sourceCommitmentsVerified = true
    const resources = nextResourceProfile(process.env.UE_V2_NEXT_MAX_HEAP_MB)
    result.resourceProfile = resources
    result.diskAdmission = nextDiskAdmission(availableDiskBytes(), 'ADMISSION')
    assert.ok((result.diskAdmission as { allowed: boolean }).allowed, 'Owned Next job requires at least 2 GiB free disk before admission')
    fixture = await openNativeRuntimeFixture(plan, { auth: true })
    const port = await unusedPort()
    mkdirSync(app, { recursive: true })
    for (const relative of ['apps/union-eyes', 'packages', 'tooling']) {
      cpSync(path.join(root, relative), path.join(snapshot, relative), {
        recursive: true,
        filter: safeSnapshotEntry,
      })
    }
    for (const file of ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'tsconfig.json'])
      if (existsSync(path.join(root, file)))
        cpSync(path.join(root, file), path.join(snapshot, file))
    symlinkSync(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'junction')
    symlinkSync(
      path.join(root, 'apps', 'union-eyes', 'node_modules'),
      path.join(app, 'node_modules'),
      'junction',
    )
    const boundary = path.join(app, 'scripts', 'bootstrap-v2', 'next-network-boundary.cjs')
    result.boundarySourceDigest = hash(readFileSync(boundary, 'utf8'))
    mkdirSync(statePath)
    assert.ok(!statePath.startsWith(`${snapshot}${path.sep}`), 'Owned HOME must be outside copied workspace')
    const env = syntheticNextEnvironment(fixture, port, boundary, statePath, resources)
    assert.ok(env.AUTH_MFA_ENCRYPTION_KEY)
    const httpFixture = await seedNextHttpSmoke(
      fixture.seed,
      env.AUTH_MFA_ENCRYPTION_KEY!,
      authenticatedCaseworkLoad || browserAcceptance,
    )
    vault = await openLocalVaultFixture(statePath)
    Object.assign(env, vault.environment)
    const requiredPorts = env.UE_V2_LOCAL_PORTS
    assert.ok(typeof requiredPorts === 'string' && /^\d+(?:,\d+)*$/.test(requiredPorts),
      'Owned Next environment must declare its database and HTTP ports')
    const allOwnedPorts = `${requiredPorts},${vault.ports.join(',')}`
    env.UE_V2_LOCAL_PORTS = allOwnedPorts
    result.ownedLocalPorts = [...new Set(allOwnedPorts.split(',').map(Number))]
    result.environment = environmentClassifications(env)
    const connectionSurface = collectConnectionEnvironmentSurface(snapshot)
    result.sourceConnectionEnvironment = {
      ...connectionSurface,
      classifications: classifyConnectionEnvironment(connectionSurface, env),
      censusStatus:
        connectionSurface.dynamicSelectors.length === 0
          ? 'LITERAL_SURFACE_DERIVED'
          : 'DYNAMIC_SELECTORS_UNRESOLVED',
    }
    const dotenvFiles = snapshotDotenvFiles(snapshot)
    result.dotenvFilesCopied = dotenvFiles.length
    assert.deepEqual(dotenvFiles, [], 'Copied snapshot contains Next dotenv configuration')
    result.sourceSnapshotDigest = digestTree(snapshot)
    const sanitizer = nextOutputSanitizer(fixture, [
      env.AUTH_SECRET,
      env.AUTH_MFA_ENCRYPTION_KEY,
      env.VOTING_SECRET,
      httpFixture.password,
      httpFixture.mfaSecret,
      ...vault.secrets,
    ].filter((value): value is string => Boolean(value)))
    redact = sanitizer.redact
    countPersistedSecrets = sanitizer.countPersistedSecrets
    const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
    const launch = (args: string[]) => {
      output = ''
      const process = spawn(globalThis.process.execPath, [next, ...args], {
        cwd: app,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: globalThis.process.platform !== 'win32',
      })
      process.stdout?.on('data', (bytes: Buffer) => {
        output += bytes.toString()
        writeFileSync(path.join(snapshot, 'next-process.log'), redact(output))
      })
      process.stderr?.on('data', (bytes: Buffer) => {
        output += bytes.toString()
        writeFileSync(path.join(snapshot, 'next-process.log'), redact(output))
      })
      return process
    }
    const verifyBoundary = () => {
      const loaded = [...output.matchAll(/^UE_V2_BOUNDARY_LOADED:(\{[^\r\n]*\})$/gm)].map(
        (match) => JSON.parse(match[1]) as { pid: number; sourceDigest: string },
      )
      assert.ok(
        loaded.some(
          (entry) => entry.pid === child?.pid && entry.sourceDigest === result.boundarySourceDigest,
        ),
        'Actual Next child did not load the source-bound transport observer',
      )
      assert.ok(
        loaded.every((entry) => entry.sourceDigest === result.boundarySourceDigest),
        'A Node worker loaded a different transport observer',
      )
      return loaded
    }
    result.preBuildDiskAdmission = nextDiskAdmission(availableDiskBytes(), 'ADMISSION')
    assert.ok((result.preBuildDiskAdmission as { allowed: boolean }).allowed,
      'Owned Next build requires at least 2 GiB free disk after source snapshot creation')
    child = launch(['build', '--webpack'])
    const diskProof = { status: 'OBSERVING', minimumObservedAvailableBytes: availableDiskBytes(), observations: 0, cancellationReason: null as string | null }
    result.buildDiskWatchdog = diskProof
    const buildExitCode = await new Promise<number | null>((resolve, reject) => {
      let cancelling = false
      const cancel = (reason: string) => {
        if (cancelling) return
        cancelling = true
        diskProof.status = 'CANCELLED_OWNED_JOB'
        diskProof.cancellationReason = reason
        void stop(child).then(() => reject(new Error(reason)), reject)
      }
      const diskTimer = setInterval(() => {
        try {
          const observation = nextDiskAdmission(availableDiskBytes(), 'BUILD')
          diskProof.observations++
          diskProof.minimumObservedAvailableBytes = Math.min(diskProof.minimumObservedAvailableBytes, observation.availableBytes)
          if (!observation.allowed) cancel('Owned Next build cancelled: available disk fell below 1 GiB; runtime proof is incomplete')
        } catch { cancel('Owned Next build cancelled: free-disk observation failed; runtime proof is incomplete') }
      }, resources.diskPollIntervalMs)
      const timeout = setTimeout(
        () => cancel('Actual production Next build exceeded 30 minutes; runtime proof is incomplete'),
        1800000,
      )
      child!.once('close', () => { clearTimeout(timeout); clearInterval(diskTimer) })
      child!.once('error', reject)
      child!.once('close', (code) => {
        if (!cancelling) { diskProof.status = 'BUILD_EXITED'; resolve(code) }
      })
    })
    result.buildExitCode = buildExitCode
    result.buildOutput = redact(output)
    networkObservations.push(...observedNetworkEvents(output).map((event) => ({ phase, event })))
    result.buildBoundaryLoads = verifyBoundary()
    assert.equal(buildExitCode, 0, 'Actual production Next build failed')
    result.buildArtifactDigest = digestTree(path.join(app, '.next'))
    result.nextBuild = 'PASS'
    phase = 'SERVER'
    child = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)])
    for (let attempt = 0; attempt < 120; attempt++) {
      assert.equal(child.exitCode, null, 'Actual Next server exited during initialization')
      if (output.includes('Ready in')) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.match(output, /Ready in/, 'Actual Next server did not become ready')
    result.serverBoundaryLoads = verifyBoundary()
    result.nextRuntimeReady = 'PASS'
    const response = await fetch(`http://127.0.0.1:${port}/api/version`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(120000),
    })
    result.initialHttpProbe = { path: '/api/version', status: response.status }
    assert.equal(response.status, 200, 'Actual version HTTP probe failed')
    result.serverOutput = redact(output)
    const httpObservations: HttpObservation[] = []
    result.httpObservations = httpObservations
    const httpSmoke = await runNextHttpSmoke(
      `http://127.0.0.1:${port}`,
      fixture.seed,
      httpFixture,
      httpObservations,
      authenticatedCaseworkLoad
        ? {
            authenticatedCaseworkLoad: {
              runtimeUrl: fixture.runtimeUrl,
              authUrl: fixture.authUrl!,
            },
          }
        : {},
    )
    result.httpSmoke = httpSmoke
    result.authenticatedCaseworkLoad = httpSmoke.authenticatedCaseworkLoad
    // Collect independent browser evidence even when a completed load profile misses its thresholds.
    if (browserAcceptance) result.browserAcceptance = await runBrowserAcceptance({
      origin: `http://127.0.0.1:${port}`, seed: fixture.seed, fixture: httpFixture,
      runtimeUrl: fixture.runtimeUrl, authUrl: fixture.authUrl!, stateDirectory: statePath,
    })
    assert.equal(httpSmoke.status, 'PASS', 'Actual authenticated casework load profile failed')
    if (browserAcceptance) assert.equal((result.browserAcceptance as { status: string }).status, 'PASS', 'Actual V2 browser journeys failed')
    result.serverOutput = redact(output)
    result.serverRuntimeSmoke = 'PASS'
    // Remaining canonical action/environment proofs are separately bound. Positive finance is excluded.
    result.status = 'HTTP_SMOKE_PASS_FINAL_ACCEPTANCE_NOT_PROVEN'
  } catch (error) {
    result.error = redact(error instanceof Error ? error.message : String(error))
    result.lastProcessOutput = redact(output)
    if (browserAcceptance && (result.browserAcceptance as { status: string }).status === 'PENDING')
      result.browserAcceptance = { status: 'INCOMPLETE', reason: 'Requested browser journeys did not reach execution; see sanitized run error.' }
    if (
      authenticatedCaseworkLoad &&
      (result.authenticatedCaseworkLoad as { status: string }).status === 'PENDING'
    ) {
      result.authenticatedCaseworkLoad = {
        status: 'INCOMPLETE',
        reason:
          'Requested profile did not reach a complete measured result; see the sanitized run error.',
      }
    }
  } finally {
    const failures: string[] = []
    let databaseRemoved = false
    let authClientsClosed = false
    try {
      await stop(child)
    } catch (error) {
      failures.push(String(error))
    }
    try {
      if (phase === 'SERVER' || !('buildExitCode' in result))
        networkObservations.push(
          ...observedNetworkEvents(output).map((event) => ({ phase, event })),
        )
      result.networkObservations = networkObservations
      result.observedAllowedConnections = networkObservations.filter(
        ({ event }) => event.allowed === true,
      ).length
      result.observedDeniedNetworkAttempts = networkObservations.filter(
        ({ event }) => event.allowed === false,
      ).length
      result.externalConnectionTargets = new Set(
        networkObservations
          .filter(({ event }) => event.allowed === true && event.targetClass !== 'LOOPBACK')
          .map(({ event }) => event.targetDigest),
      ).size
    } catch (error) {
      result.externalConnectionTargets = 'NOT_OBSERVED'
      failures.push(`Network observation decoding failed: ${String(error)}`)
    }
    result.networkProofLimitations = [
      'Node transport observations do not qualify native binaries or arbitrary child executables.',
      'A zero observed external target count is not an OS-level network isolation proof.',
    ]
    try {
      result.vaultObservations = vault?.observations
      result.vaultCleanup = await vault?.dispose()
    } catch (error) {
      failures.push(String(error))
    }
    try {
      await closeAuthClients()
      authClientsClosed = true
    } catch (error) {
      failures.push(String(error))
    }
    try {
      if (fixture) {
        await fixture.dispose()
        databaseRemoved = true
      }
    } catch (error) {
      failures.push(String(error))
    }
    try {
      if (output) {
        const progress = path.join(root, 'artifacts', `ue-v2-next-progress-${ownership}.log`)
        const sanitized = redact(output)
        if (countPersistedSecrets) assert.equal(countPersistedSecrets(sanitized), 0)
        writeFileSync(progress, sanitized)
        result.processProgressLog = { path: path.relative(root, progress), sha256: hash(sanitized), phase }
      }
    } catch (error) {
      failures.push(String(error))
    }
    try {
      rmSync(snapshot, { recursive: true, force: true })
    } catch (error) {
      failures.push(String(error))
    }
    try {
      rmSync(statePath, { recursive: true, force: true })
    } catch (error) {
      failures.push(String(error))
    }
    result.cleanup = {
      ownedServerExited: !child || child.exitCode !== null || child.signalCode !== null,
      ownedAuthClientsClosed: authClientsClosed,
      ownedDatabaseRemoved: databaseRemoved,
      ownedSnapshotRemoved: !existsSync(snapshot),
      ownedStateRemoved: !existsSync(statePath),
      errors: failures,
    }
    try { result.trackedSourceChangesAtEnd = trackedSourceChanges() }
    catch { failures.push('Tracked source cleanliness could not be verified') }
    mkdirSync(folder, { recursive: true })
    const serialized = redact(JSON.stringify(result))
    result.rawSyntheticSecretsPersisted = countPersistedSecrets
      ? countPersistedSecrets(serialized)
      : 'NOT_VERIFIED'
    const receipt = await format(redact(JSON.stringify(result)), { parser: 'json' })
    if (countPersistedSecrets)
      assert.equal(countPersistedSecrets(receipt), 0, 'Synthetic secret reached persisted receipt')
    writeFileSync(path.join(folder, 'UE_V2_NEXT_RUNTIME_ACCEPTANCE.json'), receipt)
    writeFileSync(path.join(root, 'artifacts', `ue-v2-next-receipt-${ownership}.json`), receipt)
    // The returned/default-CLI summary must use the same sanitized values as the persisted proof.
    Object.assign(result, JSON.parse(receipt) as Record<string, unknown>)
  }
  return result
}

export function runNextEngineeringCI() {
  const directory = path.join(root, 'artifacts', 'ue-v2-next-ci')
  assert.ok(!existsSync(directory), 'Fresh owned engineering artifact directory required')
  mkdirSync(directory, { recursive: true })
  const executionId = randomUUID()
  let rawExit: Record<string, unknown> | undefined
  try {
    assert.equal(process.env.UE_V2_BROWSER_ACCEPTANCE, '1')
    assert.equal(process.env.UE_V2_AUTHENTICATED_CASEWORK_LOAD, '1')
    const sourceSha = process.env.UE_V2_EXPECTED_SOURCE_SHA
    assert.ok(sourceSha && /^[a-f0-9]{40}$/.test(sourceSha), 'Exact expected candidate SHA required')
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceSha)
    assert.deepEqual(trackedSourceChanges(), [], 'Tracked input sources must match the checked-out candidate')
    const planBytes = readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')
    const expected: NextEngineeringExpectation = { executionId, sourceSha,
      sourcePlanDigest: hash(JSON.stringify(JSON.parse(planBytes))), sourcePlanFileSha256: hash(planBytes),
      boundarySourceDigest: hash(readFileSync(new URL('./next-network-boundary.cjs', import.meta.url), 'utf8')) }
    // Run the historical CLI unchanged as a real child; never normalize its actual exit status.
    const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], {
      cwd: process.cwd(), env: { ...process.env, UE_V2_NEXT_EXECUTION_ID: executionId },
      encoding: 'utf8', maxBuffer: 16 * 1024 ** 2, timeout: 70 * 60_000,
    })
    rawExit = { code: child.status, signal: child.signal,
      launchError: child.error ? (child.error as NodeJS.ErrnoException).code ?? 'CHILD_EXECUTION_ERROR' : null }
    writeFileSync(path.join(directory, 'runtime-exit.json'), JSON.stringify(rawExit, null, 2) + '\n')
    const runtimeBytes = readFileSync(path.join(folder, 'UE_V2_NEXT_RUNTIME_ACCEPTANCE.json'), 'utf8')
    const runtime = proofObject(JSON.parse(runtimeBytes), 'fresh runtime receipt')
    assert.equal(runtime.executionId, executionId, 'No fresh execution receipt; historical proof cannot substitute')
    writeFileSync(path.join(directory, 'runtime-receipt.json'), runtimeBytes)
    // Only a run that verified redaction can contribute captured output to an uploaded artifact.
    assert.equal(runtime.rawSyntheticSecretsPersisted, 0, 'Unverified output cannot be retained')
    writeFileSync(path.join(directory, 'runtime-command.log'), (child.stdout ?? '') + (child.stderr ?? ''))
    const progress = proofObject(runtime.processProgressLog, 'owned progress artifact')
    assert.ok(typeof progress.path === 'string' && /^artifacts\/ue-v2-next-progress-[a-f0-9-]{36}\.log$/.test(progress.path))
    const progressFile = path.join(root, progress.path)
    assert.ok(lstatSync(progressFile).isFile() && !lstatSync(progressFile).isSymbolicLink(), 'Owned progress file required')
    cpSync(progressFile, path.join(directory, 'runtime-progress.log'))
    const artifacts = nextRawArtifactNames.map((file) => {
      const data = readFileSync(path.join(directory, file))
      return { file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }
    })
    writeFileSync(path.join(directory, 'raw-artifacts.json'), JSON.stringify({ executionId, sourceSha, artifacts }, null, 2) + '\n')
    const proof = verifyNextEngineeringArtifacts(directory, expected)
    const componentReceipt = { ...proof, expected, rawArtifactsIndexSha256: hash(readFileSync(path.join(directory, 'raw-artifacts.json'), 'utf8')),
      limitations: ['Default CLI/global acceptance remains unproven. This is not staging GO or production authorization.',
        'Other bootstrap, security, recovery and release requirements remain independently required.',
        'Observed Node transports do not establish OS-level isolation of arbitrary native executables.'] }
    writeFileSync(path.join(directory, 'component-qualification.json'), JSON.stringify(componentReceipt, null, 2) + '\n')
    return componentReceipt
  } catch {
    writeFileSync(path.join(directory, 'component-qualification.json'), JSON.stringify({
      status: 'FAIL_REQUIRED_ENGINEERING_COMPONENTS', executionId, rawExit: rawExit ?? null,
      sourceSha: process.env.UE_V2_EXPECTED_SOURCE_SHA ?? null,
      stagingAcceptance: 'NOT_PROVEN', productionDeployment: false,
      failure: 'Required execution, component evidence, source provenance, artifact integrity or cleanup did not verify. See sanitized raw artifacts when available.',
    }, null, 2) + '\n')
    throw new Error('V2 required engineering components did not qualify')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--ci-engineering-components')) {
    try { console.log(JSON.stringify(runNextEngineeringCI())) }
    catch (error) { console.error((error as Error).message); process.exitCode = 1 }
  } else void runNextAcceptance().then((result) => {
    console.log(
      JSON.stringify({
        status: result.status,
        nextBuild: result.nextBuild,
        nextRuntimeReady: result.nextRuntimeReady,
        error: result.error,
        cleanup: result.cleanup,
      }),
    )
    process.exitCode = result.status === 'PASS' ? 0 : 1
  })
}
