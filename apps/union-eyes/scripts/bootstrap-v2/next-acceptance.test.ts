import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import {
  environmentClassifications,
  observedNetworkEvents,
  safeSnapshotEntry,
  syntheticNextEnvironment,
  nextResourceProfile,
  nextDiskAdmission,
  nextOutputSanitizer,
  verifyNextEngineeringComponents,
  verifyNextEngineeringArtifacts,
} from './next-acceptance'
import { BROWSER_PROFILES, REQUIRED_BROWSER_CHECKS } from './browser-acceptance'
import { AUTHENTICATED_CASEWORK_PROFILE, assessStage } from './authenticated-casework-load'

const ownedDatabaseUrls = (url: string) => ({
  runtimeUrl: url,
  systemUrl: url.replace('synthetic:', 'synthetic_system:'),
  authUrl: url.replace('synthetic:', 'synthetic_auth:'),
  authSystemUrl: url.replace('synthetic:', 'synthetic_auth_system:'),
})

// Synthetic parser fixtures only; these are never written as actual runtime qualification evidence.
const expectation = { sourceSha: 'a'.repeat(40), executionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sourcePlanDigest: '1'.repeat(64), sourcePlanFileSha256: '2'.repeat(64), boundarySourceDigest: '3'.repeat(64) }
const progressBytes = 'synthetic parser fixture progress\n'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
function engineeringFixture() {
  const measured = (definition: { concurrency: number; durationSeconds: number; requestsPerSecond: number }) => {
    const scheduled = definition.durationSeconds * definition.requestsPerSecond
    const samples = Array<number>(scheduled).fill(5)
    return { ...definition, scheduledRequests: scheduled, requests: scheduled, skipped: 0, errors: 0,
      ...assessStage(samples, 0, scheduled), actualDurationSeconds: definition.durationSeconds,
      sampleSha256: digest(JSON.stringify(samples)), failureMetadata: [] }
  }
  const load = { status: 'PASS', profile: structuredClone(AUTHENTICATED_CASEWORK_PROFILE),
    profileDigest: digest(JSON.stringify(AUTHENTICATED_CASEWORK_PROFILE)),
    warmup: measured({ concurrency: 1, durationSeconds: AUTHENTICATED_CASEWORK_PROFILE.warmupSeconds,
      requestsPerSecond: AUTHENTICATED_CASEWORK_PROFILE.warmupRequestsPerSecond }),
    stages: AUTHENTICATED_CASEWORK_PROFILE.stages.map(measured), thresholdsRelaxed: false,
    sourceFixturesVerified: true, governedPrimaryAssignmentVerified: true, tenantDenialsBeforeAndAfter: true,
    credentialOrCaseContentPersisted: false, roles: ['member', 'steward'],
    environment: 'OWNED_DISPOSABLE_LOCALHOST_NEXT_AND_CANONICAL_POSTGRESQL' }
  const ports = [43210, 54321, 54322, 54323]
  const boundaryLoads = [{ pid: 1234, sourceDigest: expectation.boundarySourceDigest, ownedPorts: ports }]
  return { contractVersion: '2.0', status: 'HTTP_SMOKE_PASS_FINAL_ACCEPTANCE_NOT_PROVEN',
    executionId: expectation.executionId, sourceSha: expectation.sourceSha,
    sourcePlanDigest: expectation.sourcePlanDigest, sourcePlanFileSha256: expectation.sourcePlanFileSha256,
    boundarySourceDigest: expectation.boundarySourceDigest, sourceSnapshotDigest: '4'.repeat(64), buildArtifactDigest: '5'.repeat(64),
    sourceCommitmentsVerified: true, trackedSourceChangesAtStart: [] as string[], trackedSourceChangesAtEnd: [] as string[],
    requestFlags: { browserAcceptance: true, authenticatedCaseworkLoad: true },
    legacyPredevInvoked: false, mandatorySecurityBypasses: [] as string[], rawSyntheticSecretsPersisted: 0,
    nextBuild: 'PASS', buildExitCode: 0, nextRuntimeReady: 'PASS', initialHttpProbe: { path: '/api/version', status: 200 },
    serverRuntimeSmoke: 'PASS', buildDiskWatchdog: { status: 'BUILD_EXITED', cancellationReason: null as string | null,
      minimumObservedAvailableBytes: 2 * 1024 ** 3 },
    httpSmoke: { status: 'PASS', ordinaryWrite: 'PERSISTED_RELOADED_CANONICAL_ACTOR_AND_ORGANIZATION',
      systemWrite: 'AUTHORIZED_AND_PERSISTED_ORDINARY_CALLER_DENIED', authenticatedCaseworkLoad: load,
      vault: 'OWNED_VAULT_ENCRYPTED_WRITE_DECRYPTED_RELOAD',
      platformStaff: { mechanism: 'PLATFORM_EXECUTIVE_APPOINTMENT',
        refusals: ['UNAUTHORIZED', 'FOREIGN_TENANT', 'UNAPPOINTED', 'REMOVED_EXECUTIVE'] } },
    httpObservations: [{ name: 'health', path: '/api/health', method: 'GET', status: 200 }],
    authenticatedCaseworkLoad: load,
    browserAcceptance: { status: 'PASS', setup: 'PASS', engine: 'Chromium', engineVersion: '149.0.0.0',
      externalRequestsBlocked: 0, unhandledBrowserErrors: 0, serverErrors: 0,
      cleanup: { browserClosed: true, contextsClosed: true, errors: [] as string[] },
      profiles: BROWSER_PROFILES.map((profile) => ({ id: profile.id, locale: profile.locale,
        viewport: { width: Number(profile.viewport.width), height: Number(profile.viewport.height) }, status: 'PASS',
        checks: REQUIRED_BROWSER_CHECKS.map((name) => ({ name, status: 'PASS' })) })) },
    ownedLocalPorts: ports, buildBoundaryLoads: boundaryLoads, serverBoundaryLoads: boundaryLoads,
    networkObservations: [{ phase: 'SERVER', event: { allowed: true, targetClass: 'LOOPBACK',
      targetDigest: '6'.repeat(64), transport: 'TCP', port: 54321 } }],
    observedAllowedConnections: 1, observedDeniedNetworkAttempts: 0, externalConnectionTargets: 0,
    environment: ['DATABASE_URL', 'SYSTEM_DATABASE_URL', 'AUTH_DATABASE_URL', 'AUTH_SYSTEM_DATABASE_URL', 'REDIS_URL']
      .map((key) => ({ key, classification: 'OWNED_LOOPBACK_FIXTURE' })),
    cleanup: { ownedServerExited: true, ownedAuthClientsClosed: true, ownedDatabaseRemoved: true,
      ownedSnapshotRemoved: true, ownedStateRemoved: true, errors: [] as string[] },
    vaultCleanup: { ownedIdentityExited: true, ownedVaultExited: true },
    redisCleanup: { ownedRedisRemoved: true, keysObservedBeforeRemoval: 3 },
    vaultObservations: { identityAccepted: 1, identityDenied: 0, challenges: 1, keysAccepted: 1, keysDenied: 0, wrapsAccepted: 1, unwrapsAccepted: 1, rotationsAccepted: 0 },
    processProgressLog: { path: `artifacts/ue-v2-next-progress-${expectation.executionId}.log`, phase: 'SERVER', sha256: digest(progressBytes) } }
}
const rawExit = () => ({ code: 1, signal: null as string | null, launchError: null as string | null })

describe('existing V2 engineering component evidence verification (synthetic parser fixtures)', () => {
  it('accepts every required component while retaining actual raw1 and global acceptance-unproven', () => {
    expect(verifyNextEngineeringComponents(engineeringFixture(), rawExit(), expectation)).toMatchObject({
      status: 'PASS_REQUIRED_ENGINEERING_COMPONENTS', rawCliExitCode: 1,
      globalAcceptanceStatus: 'HTTP_SMOKE_PASS_FINAL_ACCEPTANCE_NOT_PROVEN', stagingAcceptance: 'NOT_PROVEN', productionDeployment: false,
    })
  })

  it.each(['FAIL', 'PASS', 'SKIPPED', 'UNEXECUTED', 'UNKNOWN'])('rejects a substituted global status %s', (status) => {
    expect(() => verifyNextEngineeringComponents({ ...engineeringFixture(), status }, rawExit(), expectation)).toThrow()
  })

  it.each(['FAIL', 'SKIPPED', 'UNEXECUTED', 'UNKNOWN'])('rejects non-passing required components %s', (status) => {
    for (const change of [
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.nextBuild = status },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.httpSmoke.status = status },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.browserAcceptance.status = status },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.status = status },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.browserAcceptance.profiles[0].checks[0].status = status },
    ]) {
      const fixture = engineeringFixture(); change(fixture)
      expect(() => verifyNextEngineeringComponents(fixture, rawExit(), expectation)).toThrow()
    }
  })

  it.each(['browserAcceptance', 'authenticatedCaseworkLoad', 'httpSmoke', 'cleanup', 'sourcePlanDigest', 'networkObservations'])
    ('rejects missing required evidence %s', (key) => {
      const fixture = engineeringFixture(); Reflect.deleteProperty(fixture, key)
      expect(() => verifyNextEngineeringComponents(fixture, rawExit(), expectation)).toThrow()
    })

  it('rejects raw CLI success, cancellation, launch failure and an unknown exit', () => {
    for (const exit of [{ ...rawExit(), code: 0 }, { ...rawExit(), code: 2 }, { ...rawExit(), code: null },
      { ...rawExit(), signal: 'SIGTERM' }, { ...rawExit(), launchError: 'ETIMEDOUT' }])
      expect(() => verifyNextEngineeringComponents(engineeringFixture(), exit, expectation)).toThrow()
  })

  it('rejects stale source/plan/observer/execution provenance and mutated tracked source inputs', () => {
    for (const key of ['sourceSha', 'sourcePlanDigest', 'sourcePlanFileSha256', 'boundarySourceDigest', 'executionId'])
      expect(() => verifyNextEngineeringComponents({ ...engineeringFixture(), [key]: 'unbound' }, rawExit(), expectation)).toThrow()
    for (const key of ['trackedSourceChangesAtStart', 'trackedSourceChangesAtEnd'])
      expect(() => verifyNextEngineeringComponents({ ...engineeringFixture(), [key]: ['apps/union-eyes/app/layout.tsx'] }, rawExit(), expectation)).toThrow()
  })

  it('rejects missing profiles/actions and successful labels on shortened, slow or erroring load samples', () => {
    const mutations = [
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.browserAcceptance.profiles.pop() },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.browserAcceptance.profiles[0].checks.pop() },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.stages[0].durationSeconds = 5 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.stages[0].requests = 1 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.stages[0].p95Ms = 501; fixture.authenticatedCaseworkLoad.stages[0].p99Ms = 501; fixture.authenticatedCaseworkLoad.stages[0].maxMs = 501 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.stages[0].errors = 1 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.stages[0].actualDurationSeconds = 1 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.authenticatedCaseworkLoad.thresholdsRelaxed = true },
    ]
    for (const mutate of mutations) {
      const fixture = engineeringFixture(); mutate(fixture)
      expect(() => verifyNextEngineeringComponents(fixture, rawExit(), expectation)).toThrow()
    }
  })

  it('rejects unsafe observations, leaked credentials, disabled flags and every incomplete cleanup', () => {
    const mutations = [
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.rawSyntheticSecretsPersisted = 1 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.networkObservations[0].event.allowed = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.networkObservations[0].event.targetClass = 'NON_LOOPBACK' },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.networkObservations[0].event.port = 1 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.requestFlags.browserAcceptance = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.ownedDatabaseRemoved = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.ownedAuthClientsClosed = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.ownedServerExited = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.ownedStateRemoved = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.ownedSnapshotRemoved = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.cleanup.errors.push('NOT_CLEAN') },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.vaultCleanup.ownedVaultExited = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.redisCleanup.ownedRedisRemoved = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.redisCleanup.keysObservedBeforeRemoval = 0 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.vaultObservations.identityAccepted = 0 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.vaultObservations.wrapsAccepted = 0; fixture.vaultObservations.unwrapsAccepted = 0 },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.httpSmoke.vault = 'UNEXERCISED' },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.httpSmoke.platformStaff.refusals.pop() },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.httpSmoke.platformStaff.mechanism = 'ROLE_TITLE' },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.environment = fixture.environment.filter((row) => row.key !== 'REDIS_URL') },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.browserAcceptance.cleanup.contextsClosed = false },
      (fixture: ReturnType<typeof engineeringFixture>) => { fixture.buildDiskWatchdog.status = 'CANCELLED_OWNED_JOB' },
    ]
    for (const mutate of mutations) {
      const fixture = engineeringFixture(); mutate(fixture)
      expect(() => verifyNextEngineeringComponents(fixture, rawExit(), expectation)).toThrow()
    }
  })

  it.each(['changed-bytes', 'missing', 'duplicate', 'traversal', 'wrong-index-sha', 'symbolic-link'])
    ('checks actual raw artifact bytes and refuses %s', (kind) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'ue-next-verifier-'))
      const files = { 'runtime-receipt.json': JSON.stringify(engineeringFixture()),
        'runtime-exit.json': JSON.stringify(rawExit()), 'runtime-command.log': 'synthetic raw CLI parser fixture',
        'runtime-progress.log': progressBytes }
      const artifacts = Object.entries(files).map(([file, bytes]) => {
        writeFileSync(path.join(directory, file), bytes)
        return { file, bytes: Buffer.byteLength(bytes), sha256: digest(bytes) }
      })
      const index = { executionId: expectation.executionId, sourceSha: expectation.sourceSha, artifacts }
      const indexFile = path.join(directory, 'raw-artifacts.json')
      const writeIndex = () => writeFileSync(indexFile, JSON.stringify(index))
      writeIndex()
      try {
        expect(verifyNextEngineeringArtifacts(directory, expectation).status).toBe('PASS_REQUIRED_ENGINEERING_COMPONENTS')
        if (kind === 'changed-bytes') writeFileSync(path.join(directory, 'runtime-command.log'), 'altered parser fixture')
        if (kind === 'missing') rmSync(path.join(directory, 'runtime-progress.log'))
        if (kind === 'duplicate') { artifacts[1] = artifacts[0]; writeIndex() }
        if (kind === 'traversal') { artifacts[0].file = '../unowned'; writeIndex() }
        if (kind === 'wrong-index-sha') { index.sourceSha = 'b'.repeat(40); writeIndex() }
        if (kind === 'symbolic-link') {
          const file = path.join(directory, 'runtime-command.log')
          rmSync(file)
          writeFileSync(path.join(directory, 'unowned-log'), files['runtime-command.log'])
          symlinkSync(path.join(directory, 'unowned-log'), file)
        }
        expect(() => verifyNextEngineeringArtifacts(directory, expectation)).toThrow()
      } finally { rmSync(directory, { recursive: true, force: true }) }
    })
})

describe('isolated actual Next acceptance boundary', () => {
  it('bounds each Node heap by default and refuses unvalidated resource overrides', () => {
    expect(nextResourceProfile(undefined).maxOldSpaceMb).toBe(4096)
    expect(nextResourceProfile('6144')).toMatchObject({ maxOldSpaceMb: 6144, explicitOverride: true })
    for (const value of ['', '0', '512', '8193', '4GB', '4096 --require injection'])
      expect(() => nextResourceProfile(value)).toThrow()
  })
  it('refuses disk-poor admission and cancels the owned build before the one-GiB floor', () => {
    expect(nextDiskAdmission(2 * 1024 ** 3, 'ADMISSION').allowed).toBe(true)
    expect(nextDiskAdmission(2 * 1024 ** 3 - 1, 'ADMISSION').allowed).toBe(false)
    expect(nextDiskAdmission(1024 ** 3, 'BUILD').allowed).toBe(true)
    expect(nextDiskAdmission(1024 ** 3 - 1, 'BUILD').allowed).toBe(false)
    for (const available of [Number.NaN, Number.POSITIVE_INFINITY, -1])
      expect(() => nextDiskAdmission(available, 'BUILD')).toThrow()
  })
  it('retains original licensed Poppins weights without a Google build-time fetch', () => {
    const directory = fileURLToPath(new URL('../../public/fonts/poppins/', import.meta.url))
    const provenance = JSON.parse(
      readFileSync(path.join(directory, 'provenance.json'), 'utf8'),
    ) as { files: Record<string, string>; modified: boolean; license: string }
    expect(provenance.modified).toBe(false)
    expect(provenance.license).toBe('SIL Open Font License 1.1')
    for (const [file, expected] of Object.entries(provenance.files))
      expect(
        createHash('sha256')
          .update(readFileSync(path.join(directory, file)))
          .digest('hex'),
      ).toBe(expected)
    const layout = readFileSync(
      fileURLToPath(new URL('../../app/layout.tsx', import.meta.url)),
      'utf8',
    )
    expect(layout).toContain("from 'next/font/local'")
    expect(layout).not.toContain('next/font/google')
    expect(readFileSync(path.join(directory, 'OFL.txt'), 'utf8')).toContain(
      'Copyright 2020 The Poppins Project Authors',
    )
  })
  it('does not copy any Next dotenv variant or dependency/build output', () => {
    for (const name of [
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
      'node_modules',
      '.next',
      '.git',
    ])
      expect(safeSnapshotEntry(path.join('source', name))).toBe(false)
    expect(safeSnapshotEntry(path.join('source', 'instrumentation.ts'))).toBe(true)
  })

  it('constructs synthetic children without inherited credentials, proxies or node injection', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'must-not-propagate')
    vi.stubEnv('NODE_OPTIONS', '--require workstation-injection')
    vi.stubEnv('HTTP_PROXY', 'http://external.invalid')
    try {
      const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
      const env = syntheticNextEnvironment(
        ownedDatabaseUrls(url),
        43210,
        'local-boundary.cjs',
      )
      expect(env.STRIPE_SECRET_KEY).toBeUndefined()
      expect(env.HTTP_PROXY).toBeUndefined()
      expect(env.NODE_OPTIONS).not.toContain('workstation')
      expect(env.NODE_OPTIONS).toContain('--max-old-space-size=4096')
      expect(env.CRON_SECRET).toMatch(/^[a-f0-9]{96}$/)
      expect(env.CRON_SECRET).not.toBe('ue-v2-cron-secret')
      expect(env.HOME).not.toContain(path.dirname(path.resolve('local-boundary.cjs')) + path.sep)
      expect(env.SKIP_DB_STARTUP_CHECK).toBeUndefined()
      expect(env.PLAYWRIGHT_TEST_AUTH).toBeUndefined()
      expect(env.OTEL_SDK_DISABLED).toBe('true')
      expect(
        environmentClassifications(env).filter(
          (entry) => entry.classification === 'OWNED_LOOPBACK_FIXTURE',
        ),
      ).toHaveLength(4)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('uses separate ordinary and system authentication credentials in the actual child environment', () => {
    const urls = ownedDatabaseUrls('postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture')
    const env = syntheticNextEnvironment(urls, 43210, 'boundary.cjs')
    expect(env.AUTH_DATABASE_URL).toBe(urls.authUrl)
    expect(env.AUTH_SYSTEM_DATABASE_URL).toBe(urls.authSystemUrl)
    expect(env.AUTH_SYSTEM_DATABASE_URL).not.toBe(env.AUTH_DATABASE_URL)
  })

  it('redacts the distinct auth-system password in plain and URL-encoded outputs and refuses persisted secrets', () => {
    const urls = ownedDatabaseUrls('postgresql://synthetic:ordinary-password@127.0.0.1:54321/local_fixture')
    urls.authSystemUrl = urls.authSystemUrl.replace(':ordinary-password@', ':owned-auth-system%21secret@')
    const sanitizer = nextOutputSanitizer(urls, ['owned-extra-secret'])
    const raw = `${urls.authSystemUrl} owned-auth-system!secret ordinary-password owned-extra-secret`
    expect(sanitizer.countPersistedSecrets(raw)).toBe(4)
    const safe = sanitizer.redact(raw)
    for (const secret of ['owned-auth-system%21secret', 'owned-auth-system!secret', 'ordinary-password', 'owned-extra-secret'])
      expect(safe).not.toContain(secret)
    expect(sanitizer.countPersistedSecrets(safe)).toBe(0)
  })

  it.each(['missing', 'ordinary', 'changed-password', 'external', 'other-port', 'other-database', 'encoded-alias'] as const)(
    'refuses missing, reused or unowned auth-system credentials: %s', (kind) => {
      const urls = ownedDatabaseUrls('postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture')
      const authSystemUrl = {
        missing: undefined,
        ordinary: urls.authUrl,
        'changed-password': urls.authUrl.replace(':synthetic@', ':different@'),
        external: urls.authSystemUrl.replace('127.0.0.1', 'external.invalid'),
        'other-port': urls.authSystemUrl.replace('54321', '54322'),
        'other-database': urls.authSystemUrl.replace('local_fixture', 'unowned_database'),
        'encoded-alias': urls.authUrl.replace('synthetic_auth:', '%73ynthetic_auth:'),
      }[kind]
      expect(() => syntheticNextEnvironment({ ...urls, authSystemUrl }, 43210, 'boundary.cjs')).toThrow()
    },
  )

  it('rejects external database URLs before a child can start', () => {
    expect(() =>
      syntheticNextEnvironment(
        {
          runtimeUrl: 'postgresql://user:password@external.invalid/db',
          systemUrl: '',
          authUrl: '',
        },
        43210,
        'boundary.cjs',
      ),
    ).toThrow()
  })

  it('loads the real Windows preload and denies external and unowned loopback sockets', () => {
    const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
    const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
    const env = syntheticNextEnvironment(
      ownedDatabaseUrls(url),
      43210,
      boundary,
    )
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const net=require('node:net'); const dns=require('node:dns');
        for(const [host,port] of [['external.invalid',54321],['127.0.0.1',54322],['169.254.169.254',80],['127.0.0.1',0]]) {
          try { net.connect({host,port}); process.exit(2); }
          catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        }
        try { dns.lookup('external.invalid',()=>{}); process.exit(3); }
        catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        try { net.connect({path:'\\\\\\\\.\\\\pipe\\\\unowned'}); process.exit(4); }
        catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        console.log('BOUNDARY_DENIALS_PROVEN');`,
      ],
      { env, encoding: 'utf8', timeout: 10000 },
    )
    const observations = observedNetworkEvents(child.stderr)
    expect(observations).toHaveLength(6)
    expect(observations.every((event) => event.allowed === false)).toBe(true)
    expect(child.stderr).not.toContain('external.invalid')
    expect(child.stderr).not.toContain('unowned')
    expect(child.status).toBe(0)
    expect(child.stdout).toContain('BOUNDARY_DENIALS_PROVEN')
  })

  it('permits owned HTTP while containing fetch, DNS, UDP and inherited workers', async () => {
    const server = net.createServer((socket) => {
      socket.on('data', () =>
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok'),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Owned listener not created')
    const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
    const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
    const env = syntheticNextEnvironment(
      ownedDatabaseUrls(url),
      address.port,
      boundary,
    )
    try {
      const child = spawn(
        process.execPath,
        [
          '-e',
          `const assert=require('node:assert/strict'); const dns=require('node:dns');
          const dgram=require('node:dgram'); const {Worker}=require('node:worker_threads');
          (async()=>{
            assert.equal(await (await fetch('http://127.0.0.1:${address.port}')).text(),'ok');
            await assert.rejects(fetch('http://external.invalid'),e=>e.cause.code==='UE_V2_EXTERNAL_NETWORK_DENIED');
            assert.throws(()=>dns.promises.lookup('external.invalid'),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            assert.throws(()=>dns.resolve4('external.invalid',()=>{}),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            const socket=dgram.createSocket('udp4');
            assert.throws(()=>socket.send('no',53,'external.invalid'),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            socket.close();
            await new Promise((resolve,reject)=>{
              const worker=new Worker("const net=require('node:net'); const {parentPort}=require('node:worker_threads'); try {net.connect({host:'external.invalid',port:80}); process.exit(2)} catch(e) {if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED')throw e;parentPort.postMessage('denied')}",{eval:true});
              worker.once('message',m=>m==='denied'?resolve():reject(new Error(m)));
              worker.once('error',reject);
            });
            console.log('OWNED_HTTP_AND_WORKER_CONTAINMENT_PROVEN');
          })().catch(e=>{console.error(e);process.exitCode=1});`,
        ],
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let output = ''
      child.stdout.on('data', (bytes: Buffer) => (output += bytes.toString()))
      child.stderr.on('data', (bytes: Buffer) => (output += bytes.toString()))
      const exit = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', resolve)
      })
      expect(output).toContain('OWNED_HTTP_AND_WORKER_CONTAINMENT_PROVEN')
      expect(exit).toBe(0)
      const observations = observedNetworkEvents(output)
      expect(observations.some((event) => event.allowed === true)).toBe(true)
      expect(observations.some((event) => event.transport === 'UDP')).toBe(true)
      expect(observations.some((event) => event.transport === 'DNS_RESOLVE')).toBe(true)
      expect(
        observations
          .filter((event) => event.allowed === true)
          .every((event) => event.targetClass === 'LOOPBACK' && event.port === address.port),
      ).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 15000)
})
