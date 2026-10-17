import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { folder, hash, root, type V2Plan } from './source'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { openLocalVaultFixture } from './local-vault-fixture'
import { runNextHttpSmoke, seedNextHttpSmoke, type HttpObservation } from './next-http-smoke'
import {
  classifyConnectionEnvironment,
  collectConnectionEnvironmentSurface,
} from './connection-environment-surface'

const excluded = new Set(['node_modules', '.git', '.next', '.turbo', '.venv', '__pycache__'])
export function safeSnapshotEntry(file: string) {
  const name = path.basename(file)
  return !excluded.has(name) && !/^\.env(?:\.|$)/.test(name) && !name.endsWith('.tsbuildinfo')
}

export function syntheticNextEnvironment(
  urls: { runtimeUrl: string; systemUrl: string; authUrl?: string },
  port: number,
  boundary: string,
  statePath = path.resolve(path.dirname(boundary), '.runtime-state'),
): NodeJS.ProcessEnv {
  assert.ok(urls.authUrl, 'Dedicated auth fixture required')
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' }
  // No PATH, NODE_OPTIONS, proxies, provider credentials or dotenv values inherited.
  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC'])
    if (process.env[key]) env[key] = process.env[key]
  for (const value of [urls.runtimeUrl, urls.systemUrl, urls.authUrl]) {
    const url = new URL(value)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.protocol, 'postgresql:')
  }
  Object.assign(env, {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    OTEL_SDK_DISABLED: 'true',
    NODE_OPTIONS: `--max-old-space-size=8192 --require ${JSON.stringify(boundary)}`,
    UE_V2_LOCAL_PORTS: `${new URL(urls.runtimeUrl).port},${port}`,
    UE_V2_NETWORK_AUDIT: '1',
    DATABASE_URL: urls.runtimeUrl,
    SYSTEM_DATABASE_URL: urls.systemUrl,
    AUTH_DATABASE_URL: urls.authUrl,
    AUTH_SYSTEM_DATABASE_URL: urls.authUrl,
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
    PAYMENT: ['STRIPE_SECRET_KEY', 'WHOP_API_KEY', 'PAYPAL_CLIENT_SECRET'],
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
  } else child.kill()
  await exited
}

export async function runNextAcceptance() {
  const ownership = randomUUID()
  const snapshot = path.join(root, 'artifacts', `ue-v2-next-${ownership}`)
  const app = path.join(snapshot, 'apps', 'union-eyes')
  const result: Record<string, unknown> = {
    contractVersion: '2.0',
    status: 'FAIL',
    externalConnectionTargets: 'NOT_OBSERVED',
    rawSyntheticSecretsPersisted: 'NOT_VERIFIED',
    legacyPredevInvoked: false,
    mandatorySecurityBypasses: [],
  }
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  result.sourcePlanDigest = hash(JSON.stringify(plan))
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>> | undefined
  let vault: Awaited<ReturnType<typeof openLocalVaultFixture>> | undefined
  let child: ChildProcess | undefined
  let output = ''
  const networkObservations: { phase: string; event: Record<string, unknown> }[] = []
  let phase = 'BUILD'
  let redact = (value: string) => value
  let countPersistedSecrets: ((value: string) => number) | undefined
  try {
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
    const statePath = path.join(snapshot, '.runtime-state')
    mkdirSync(statePath)
    const env = syntheticNextEnvironment(fixture, port, boundary, statePath)
    assert.ok(env.AUTH_MFA_ENCRYPTION_KEY)
    const httpFixture = await seedNextHttpSmoke(fixture.seed, env.AUTH_MFA_ENCRYPTION_KEY)
    vault = await openLocalVaultFixture(statePath)
    Object.assign(env, vault.environment)
    env.UE_V2_LOCAL_PORTS += `,${vault.ports.join(',')}`
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
    const secrets = [
      env.AUTH_SECRET,
      env.AUTH_MFA_ENCRYPTION_KEY,
      env.VOTING_SECRET,
      httpFixture.password,
      httpFixture.mfaSecret,
      ...vault.secrets,
      ...[fixture.runtimeUrl, fixture.systemUrl, fixture.authUrl].map(
        (url) => url && new URL(url).password,
      ),
    ].filter((value): value is string => Boolean(value))
    redact = (value) =>
      secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
    countPersistedSecrets = (value) =>
      secrets.reduce((count, secret) => count + Number(value.includes(secret)), 0)
    const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
    const launch = (args: string[]) => {
      output = ''
      const process = spawn(globalThis.process.execPath, [next, ...args], {
        cwd: app,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
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
    child = launch(['build', '--webpack'])
    const buildExitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Actual production Next build exceeded 30 minutes')),
        1800000,
      )
      child!.once('close', () => clearTimeout(timeout))
      child!.once('error', reject)
      child!.once('close', resolve)
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
    result.httpSmoke = await runNextHttpSmoke(
      `http://127.0.0.1:${port}`,
      fixture.seed,
      httpFixture,
      httpObservations,
    )
    result.serverOutput = redact(output)
    result.serverRuntimeSmoke = 'PASS'
    // Complete caller and financial qualification remain separate gates.
    result.status = 'HTTP_SMOKE_PASS_FINAL_ACCEPTANCE_NOT_PROVEN'
  } catch (error) {
    result.error = redact(error instanceof Error ? error.message : String(error))
    result.lastProcessOutput = redact(output)
  } finally {
    const failures: string[] = []
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
      await fixture?.dispose()
    } catch (error) {
      failures.push(String(error))
    }
    try {
      rmSync(snapshot, { recursive: true, force: true })
    } catch (error) {
      failures.push(String(error))
    }
    result.cleanup = {
      ownedServerExited: !child || child.exitCode !== null || child.signalCode !== null,
      ownedSnapshotRemoved: !existsSync(snapshot),
      errors: failures,
    }
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
  }
  return result
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runNextAcceptance().then((result) => {
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
