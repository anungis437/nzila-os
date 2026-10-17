import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { openLocalVaultFixture } from './local-vault-fixture'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { syntheticNextEnvironment } from './next-acceptance'
import { buildPlan, folder, root, type V2Plan } from './source'
import { classifyRootCaller, summarizeBuckets, type CallerBucketKey } from './caller-buckets'

type InventoryCaller = {
  id: string
  kind: string
  sourcePath: string
  export: string
  sourceSha256: string
  tables: { name: string }[]
  runtimeQualification: string
}

type BucketCaseResult = {
  name: string
  status: number
  outcome: 'PASS' | 'FAIL' | 'N/A'
  note?: string
}

type RouteReceipt = {
  id: string
  sourcePath: string
  method: string
  bucket: CallerBucketKey
  cases: BucketCaseResult[]
}

function baseJsonBody() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    caseId: '11111111-1111-4111-8111-111111111111',
    claimId: '11111111-1111-4111-8111-111111111111',
    memberId: '11111111-1111-4111-8111-111111111111',
    organizationId: '00000000-0000-0000-0000-000000000001',
    title: 'Test title',
    name: 'Test name',
    description: 'This is a sufficiently long test description for schema validation.',
    content: 'Test content',
    status: 'draft',
    action: 'classify-clause',
    email: 'test@example.com',
    amount: '100.00',
    type: 'general',
    priority: 'medium',
    claimType: 'grievance_discipline',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    incidentDate: '2026-01-01T00:00:00.000Z',
    effectiveDate: '2026-01-01T00:00:00.000Z',
    dueDate: '2026-01-31T00:00:00.000Z',
    tags: ['test'],
    metadata: {},
  }
}

function concretePathFromSource(sourcePath: string) {
  return sourcePath
    .replace(/^apps\/union-eyes\/app\/api\//, '')
    .replace(/\/route\.ts$/, '')
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, 'test/path')
    .replace(/\[\.\.\.[^\]]+\]/g, 'test/path')
    .replace(/\[[^\]]+\]/g, '11111111-1111-4111-8111-111111111111')
}

async function selectOrganization(base: string, cookie: string, organizationId: string) {
  const response = await fetch(`${base}/api/organizations/switch`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId }),
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  })
  assert.equal(response.status, 200, `Organization switch failed for ${organizationId}`)
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
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

async function login(base: string, email: string, password: string, mfaSecret: string) {
  const loginResponse = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(120000),
  })
  assert.equal(loginResponse.status, 200, `Login failed for ${email}`)
  const loginBody = await loginResponse.json()
  assert.equal(loginBody.requiresMfa, true, `MFA challenge missing for ${email}`)
  const challenge = await fetch(`${base}/api/auth/mfa/challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challengeToken: loginBody.mfaChallengeToken,
      code: '000000',
    }),
    signal: AbortSignal.timeout(120000),
  })
  assert.equal(
    challenge.status,
    401,
    `Synthetic invalid MFA code was unexpectedly accepted for ${email}`,
  )
  const completed = await fetch(`${base}/api/auth/mfa/challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challengeToken: loginBody.mfaChallengeToken,
      code: computeTotp(mfaSecret),
    }),
    signal: AbortSignal.timeout(120000),
  })
  assert.equal(completed.status, 200, `MFA completion failed for ${email}`)
  return completed.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
}

function chooseCookie(
  sourcePath: string,
  source: string,
  memberCookie: string,
  adminCookie: string,
) {
  if (sourcePath.includes('/admin/')) return adminCookie
  const minRole = source.match(/withRoleAuth\(\s*['"`]([^'"`]+)['"`]/)?.[1]
  if (!minRole) return memberCookie
  return ['admin', 'officer', 'chief_steward', 'system_admin', 'platform_lead'].includes(minRole)
    ? adminCookie
    : memberCookie
}

async function invokeHttpCase(
  base: string,
  method: string,
  sourcePath: string,
  cookie: string | null,
  source: string,
  options: { foreignOrganization?: boolean } = {},
): Promise<Response> {
  const slug = concretePathFromSource(sourcePath)
  const url = new URL(`${base}/api/${slug}`)
  if (options.foreignOrganization && /organizationId|orgId|organization_id|org_id/.test(source))
    url.searchParams.set('organizationId', '33333333-3333-4333-8333-333333333333')
  url.searchParams.set('limit', '10')
  url.searchParams.set('offset', '0')
  const upper = method.toUpperCase()
  const headers: Record<string, string> = cookie ? { cookie } : {}
  let body: string | undefined
  const json = baseJsonBody()
  if (/auth:\s*\{\s*cron:\s*true/.test(source)) headers['x-cron-secret'] = 'ue-v2-cron-secret'
  if (slug === 'grievances/import' && upper === 'POST') {
    headers['content-type'] = 'application/json'
    body = JSON.stringify({
      format: 'json',
      payload: [
        {
          type: 'other',
          title: 'Imported grievance title',
          description: 'Imported grievance description with enough detail to pass validation.',
        },
      ],
      sourceSystem: 'test-import',
    })
  } else if (slug === 'social-media/accounts' && upper === 'POST') {
    headers['content-type'] = 'application/json'
    body = JSON.stringify({
      platform: 'facebook',
      account_id: '00000000-0000-0000-0000-000000000002',
    })
  } else if (slug === 'communications/webhooks/resend' && upper === 'POST') {
    headers['content-type'] = 'application/json'
    headers['svix-id'] = 'msg_test'
    headers['svix-timestamp'] = '1700000000'
    headers['svix-signature'] = 'v1,test-signature'
    body = JSON.stringify({ type: 'email.sent', data: { email_id: 'email_test' } })
  } else if (slug === 'payments/webhooks/paypal' && upper === 'POST') {
    headers['content-type'] = 'application/json'
    body = JSON.stringify({
      id: 'evt_paypal',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { custom_id: json.organizationId },
    })
  } else if (slug === 'payments/webhooks/stripe' && upper === 'POST') {
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: json.organizationId },
        },
      },
    })
    const timestamp = '1700000000'
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test'
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    headers['content-type'] = 'application/json'
    headers['stripe-signature'] = `t=${timestamp},v1=${signature}`
    body = payload
  } else if (upper === 'POST' || upper === 'PUT' || upper === 'PATCH') {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(json)
  }
  return fetch(url, {
    method: upper,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  })
}

export async function executeRouteBucket(selectedBucket?: CallerBucketKey) {
  const inventoryPath = path.join(folder, 'UE_V2_APPLICATION_ACTOR_MAP.json')
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
    candidateDigest: string
    actors: InventoryCaller[]
    sourcePlanDigest: string
  }
  const bucketed = inventory.actors.map((caller) => ({
    caller,
    classification: classifyRootCaller(caller),
  }))
  const summary = summarizeBuckets(
    inventory.actors.map((caller) => ({
      id: caller.id,
      kind: caller.kind,
      sourcePath: caller.sourcePath,
      export: caller.export,
      tables: caller.tables,
      runtimeQualification: caller.runtimeQualification,
    })),
  )
  const normalizedSelectedBucket = selectedBucket?.trim() as CallerBucketKey | undefined
  const bucket =
    normalizedSelectedBucket ??
    summary.find((entry) => entry.bucket !== 'QUALIFIED_BY_EXECUTED_CASES')?.bucket
  if (!bucket) throw new Error('UE_V2_ROUTE_BUCKET_NONE_AVAILABLE')
  const bucketSummary = summary.find((entry) => entry.bucket === bucket)
  if (!bucketSummary)
    throw new Error(
      `UE_V2_ROUTE_BUCKET_UNKNOWN:${bucket}:available=${summary.map((entry) => entry.bucket).join(',')}`,
    )
  const selected = bucketed.filter((entry) => entry.classification.bucket === bucket)
  const plan: V2Plan = await buildPlan(process.env.UE_V2_WHEELHOUSE!)
  const fixture = await openNativeRuntimeFixture(plan, { auth: true })
  const statePath = path.join(path.resolve('artifacts'), `ue-v2-bucket-${randomUUID()}`)
  mkdirSync(statePath, { recursive: true })
  const vault = await openLocalVaultFixture(statePath)
  const port = await unusedPort()
  const boundary = path.join(
    root,
    'apps',
    'union-eyes',
    'scripts',
    'bootstrap-v2',
    'next-network-boundary.cjs',
  )
  const env = syntheticNextEnvironment(fixture, port, boundary, statePath)
  Object.assign(env, vault.environment)
  env.UE_V2_LOCAL_PORTS += `,${vault.ports.join(',')}`
  env.CRON_SECRET_KEY = 'ue-v2-cron-secret'
  const appDir = path.join(root, 'apps', 'union-eyes')
  const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
  let child: ChildProcess | undefined
  const launch = (args: string[]) => {
    const process = spawn(globalThis.process.execPath, [next, ...args], {
      cwd: appDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    process.stdout?.on('data', (bytes: Buffer) => (output += bytes.toString()))
    process.stderr?.on('data', (bytes: Buffer) => (output += bytes.toString()))
    return { process, output: () => output }
  }
  const receipts: RouteReceipt[] = []
  try {
    const build = launch(['build', '--webpack'])
    child = build.process
    const buildExitCode = await new Promise<number | null>((resolve, reject) => {
      child!.once('error', reject)
      child!.once('close', resolve)
    })
    assert.equal(buildExitCode, 0, 'UE_V2_BUCKET_NEXT_BUILD_FAILED')

    const server = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)])
    child = server.process
    for (let attempt = 0; attempt < 120; attempt++) {
      assert.equal(child.exitCode, null, 'UE_V2_BUCKET_NEXT_SERVER_EXITED')
      if (server.output().includes('Ready in')) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.match(server.output(), /Ready in/, 'UE_V2_BUCKET_NEXT_SERVER_NOT_READY')
    const base = `http://127.0.0.1:${port}`
    const seeded = await import('./next-http-smoke').then((module) =>
      module.seedNextHttpSmoke(fixture.seed, env.AUTH_MFA_ENCRYPTION_KEY!),
    )
    const memberCookieUnselected = await login(
      base,
      `${seeded.actor}@example.invalid`,
      seeded.password,
      seeded.mfaSecret,
    )
    const adminCookieUnselected = await login(
      base,
      `${seeded.administrator}@example.invalid`,
      seeded.password,
      seeded.mfaSecret,
    )
    const memberCookie = await selectOrganization(
      base,
      memberCookieUnselected,
      seeded.organizations[0],
    )
    const adminCookie = await selectOrganization(
      base,
      adminCookieUnselected,
      seeded.organizations[0],
    )

    for (const { caller, classification } of selected) {
      const source = readFileSync(path.join(root, ...caller.sourcePath.split('/')), 'utf8')
      const authenticatedCookie = chooseCookie(caller.sourcePath, source, memberCookie, adminCookie)
      const unselectedCookie = chooseCookie(
        caller.sourcePath,
        source,
        memberCookieUnselected,
        adminCookieUnselected,
      )
      const cases: BucketCaseResult[] = []
      const orgContextRelevant =
        caller.sourcePath.includes('/organizations/') ||
        caller.sourcePath.includes('/notifications/') ||
        source.includes('withOrganizationAuth(') ||
        source.includes('requireUserForOrganization(') ||
        source.includes('organizationId')
      if (
        bucket === 'HTTP_GET_NEEDS_EXPLICIT_FIXTURE' ||
        bucket === 'READ_ONLY_FALSE_POSITIVE_GET'
      ) {
        const unauthenticated = await invokeHttpCase(
          base,
          caller.export,
          caller.sourcePath,
          null,
          source,
        )
        const authenticated = await invokeHttpCase(
          base,
          caller.export,
          caller.sourcePath,
          authenticatedCookie,
          source,
        )
        const wrongOrg = orgContextRelevant
          ? await invokeHttpCase(
              base,
              caller.export,
              caller.sourcePath,
              authenticatedCookie,
              source,
              {
                foreignOrganization: true,
              },
            )
          : null
        const unselected = orgContextRelevant
          ? await invokeHttpCase(base, caller.export, caller.sourcePath, unselectedCookie, source)
          : null
        let inactive: Response | null = null
        if (orgContextRelevant && authenticatedCookie === memberCookie) {
          await fixture.seed.query(
            'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2',
            [seeded.actor, seeded.organizations[0]],
          )
          inactive = await invokeHttpCase(
            base,
            caller.export,
            caller.sourcePath,
            authenticatedCookie,
            source,
          )
          await fixture.seed.query(
            'UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1 AND organization_id=$2',
            [seeded.actor, seeded.organizations[0]],
          )
        }
        cases.push(
          {
            name: 'unauthenticated',
            status: unauthenticated.status,
            outcome: unauthenticated.status >= 500 ? 'FAIL' : 'PASS',
          },
          {
            name: 'authenticated',
            status: authenticated.status,
            outcome: authenticated.status >= 500 ? 'FAIL' : 'PASS',
          },
          wrongOrg
            ? {
                name: 'wrong-org',
                status: wrongOrg.status,
                outcome: wrongOrg.status >= 500 ? 'FAIL' : 'PASS',
              }
            : {
                name: 'wrong-org',
                status: 0,
                outcome: 'N/A',
                note: 'Route source has no organization selector to forge',
              },
          unselected
            ? {
                name: 'unselected-org',
                status: unselected.status,
                outcome: unselected.status >= 500 ? 'FAIL' : 'PASS',
              }
            : {
                name: 'unselected-org',
                status: 0,
                outcome: 'N/A',
                note: 'Route source is not organization-context sensitive',
              },
          inactive
            ? {
                name: 'inactive-member',
                status: inactive.status,
                outcome: inactive.status >= 500 ? 'FAIL' : 'PASS',
              }
            : {
                name: 'inactive-member',
                status: 0,
                outcome: 'N/A',
                note: 'Inactive-member case is not applicable to this actor/route shape',
              },
          {
            name: 'valid-write',
            status: 0,
            outcome: 'N/A',
            note:
              bucket === 'READ_ONLY_FALSE_POSITIVE_GET'
                ? 'Read-only false-positive bucket: no business write case by source proof'
                : 'Generic GET bucket has no write case',
          },
          {
            name: 'persisted-canonical-actor-org',
            status: 0,
            outcome: 'N/A',
            note:
              bucket === 'READ_ONLY_FALSE_POSITIVE_GET'
                ? 'Read-only false-positive bucket: no business write persistence case'
                : 'Generic GET bucket has no persisted write/reload case',
          },
        )
      } else if (
        bucket === 'HTTP_SHARED_GUARD_MUTATION' ||
        bucket === 'HTTP_MUTATION_NEEDS_EXPLICIT_FIXTURE'
      ) {
        const unauthenticated = await invokeHttpCase(
          base,
          caller.export,
          caller.sourcePath,
          null,
          source,
        )
        const authenticated = await invokeHttpCase(
          base,
          caller.export,
          caller.sourcePath,
          authenticatedCookie,
          source,
        )
        cases.push(
          {
            name: 'unauthenticated',
            status: unauthenticated.status,
            outcome: unauthenticated.status >= 500 ? 'FAIL' : 'PASS',
          },
          {
            name: 'authenticated',
            status: authenticated.status,
            outcome: authenticated.status >= 500 ? 'FAIL' : 'PASS',
          },
          {
            name: 'forged-org-or-user',
            status: 0,
            outcome: 'N/A',
            note:
              bucket === 'HTTP_SHARED_GUARD_MUTATION'
                ? 'Generic shared-guard mutation harness has not yet synthesized a route-specific forged payload'
                : 'Generic mutation-explicit harness has not yet synthesized a route-specific forged payload',
          },
          {
            name: 'persisted-canonical-actor-org',
            status: 0,
            outcome: 'N/A',
            note:
              bucket === 'HTTP_SHARED_GUARD_MUTATION'
                ? 'Generic shared-guard mutation harness has not yet verified persisted write provenance'
                : 'Generic mutation-explicit harness has not yet verified persisted write provenance',
          },
        )
      } else if (bucket === 'NOT_IMPLEMENTED_501') {
        const response = await invokeHttpCase(
          base,
          caller.export,
          caller.sourcePath,
          authenticatedCookie,
          source,
        )
        cases.push(
          {
            name: 'authenticated',
            status: response.status,
            outcome: response.status === 501 ? 'PASS' : 'FAIL',
          },
          {
            name: 'unauthenticated',
            status: 0,
            outcome: 'N/A',
            note: '501 qualification depends on the implemented route contract, not anonymous denial',
          },
        )
      } else {
        throw new Error(`UE_V2_ROUTE_BUCKET_UNSUPPORTED:${bucket}`)
      }
      receipts.push({
        id: caller.id,
        sourcePath: caller.sourcePath,
        method: caller.export,
        bucket: classification.bucket,
        cases,
      })
    }
    const receipt = {
      candidateDigest: inventory.candidateDigest,
      sourcePlanDigest: inventory.sourcePlanDigest,
      bucket: bucketSummary,
      executedRoutes: receipts.length,
      passCount: receipts.filter((route) => route.cases.every((test) => test.outcome !== 'FAIL'))
        .length,
      failCount: receipts.filter((route) => route.cases.some((test) => test.outcome === 'FAIL'))
        .length,
      receipts,
    }
    writeFileSync(
      path.join(folder, `UE_V2_ROUTE_BUCKET_EXECUTION.${bucket}.json`),
      JSON.stringify(receipt, null, 2) + '\n',
    )
    return receipt
  } finally {
    await stop(child)
    await vault.dispose()
    await fixture.dispose()
    rmSync(statePath, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  executeRouteBucket(
    ((process.argv[2] ?? process.env.UE_V2_BUCKET) as CallerBucketKey | undefined) ?? undefined,
  )
    .then((receipt) => {
      process.stdout.write(`${JSON.stringify(receipt)}\n`)
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
