import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { openLocalVaultFixture } from './local-vault-fixture'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { syntheticNextEnvironment } from './next-acceptance'
import { buildPlan, folder, root, type V2Plan } from './source'

type BucketCase = {
  name: string
  status: number
  outcome: 'PASS' | 'FAIL' | 'N/A'
}

type RouteReceipt = {
  id: string
  sourcePath: string
  method: string
  bucket: string
  cases: BucketCase[]
}

type BucketReport = {
  file: string
  bucket: { bucket: string; count: number; reason: string }
  candidateDigest: string
  sourcePlanDigest: string
  receipts: RouteReceipt[]
}

type Diagnostic = {
  id: string
  sourcePath: string
  method: string
  bucket: string
  status: number
  bodySnippet: string
  sqlstate: string | null
  relation: string | null
  column: string | null
  role: string | null
  errorText: string
  rootCauses: string[]
  logExcerpt: string
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

async function invokeWithDiagnostics(
  output: () => string,
  base: string,
  receipt: RouteReceipt,
  cookie: string,
) {
  const source = readFileSync(path.join(root, ...receipt.sourcePath.split('/')), 'utf8')
  const url = new URL(`${base}/api/${concretePathFromSource(receipt.sourcePath)}`)
  url.searchParams.set('limit', '10')
  url.searchParams.set('offset', '0')
  const headers: Record<string, string> = { cookie }
  if (/auth:\s*\{\s*cron:\s*true/.test(source)) headers['x-cron-secret'] = 'ue-v2-cron-secret'
  const upper = receipt.method.toUpperCase()
  let body: string | undefined
  if (receipt.bucket.includes('MUTATION') || receipt.bucket === 'NOT_IMPLEMENTED_501') {
    const json = baseJsonBody()
    if (receipt.sourcePath.endsWith('payments/webhooks/stripe/route.ts')) {
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
      headers['content-type'] = 'application/json'
      headers['stripe-signature'] =
        `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')}`
      body = payload
    } else {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(json)
    }
  }
  const before = output().length
  const response = await fetch(url, {
    method: upper,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  })
  const bodyText = await response.text()
  const excerpt = output().slice(before)
  return { status: response.status, bodyText, excerpt }
}

function parseDiagnostic(
  receipt: RouteReceipt,
  status: number,
  bodyText: string,
  excerpt: string,
): Diagnostic {
  const sqlstate =
    excerpt.match(/\b(?:SQLSTATE|code)["':\s=]+([0-9A-Z]{5})\b/i)?.[1] ??
    bodyText.match(/\b([0-9A-Z]{5})\b/)?.[1] ??
    null
  const relation =
    excerpt.match(/relation ["'`](.+?)["'`]/i)?.[1] ??
    excerpt.match(/table ["'`](.+?)["'`]/i)?.[1] ??
    null
  const column =
    excerpt.match(/column ["'`](.+?)["'`]/i)?.[1] ??
    bodyText.match(/column ["'`](.+?)["'`]/i)?.[1] ??
    null
  const role =
    excerpt.match(/role ["'`]([a-zA-Z0-9_]+)["'`]/i)?.[1] ??
    excerpt.match(/user ["'`]([a-zA-Z0-9_]+)["'`]/i)?.[1] ??
    null
  const errorText =
    bodyText ||
    excerpt.match(/Error:\s*([^\r\n]+)/)?.[1] ||
    excerpt.match(/message["':\s]+([^\r\n,}]+)/i)?.[1] ||
    'UNCLASSIFIED_SERVER_ERROR'
  const rootCauses = [
    ...new Set(
      [
        ...excerpt.matchAll(/PostgresError: ([^"\\\r\n]{0,200})/g),
        ...excerpt.matchAll(/\b((?:Type|Reference|Range|Syntax)?Error): ([^"\\\r\n]{0,200})/g),
        ...excerpt.matchAll(/"(?:cause|error)":"((?:[^"\\]|\\.){0,200})"/g),
      ].map((match) => (match[2] ? `${match[1]}: ${match[2]}` : match[1])),
    ),
  ].slice(0, 6)
  return {
    id: receipt.id,
    sourcePath: receipt.sourcePath,
    method: receipt.method,
    bucket: receipt.bucket,
    status,
    bodySnippet: bodyText.slice(0, 500),
    sqlstate,
    relation,
    column,
    role,
    errorText,
    rootCauses,
    logExcerpt:
      excerpt.length > 6000 ? `${excerpt.slice(0, 3000)}\n…\n${excerpt.slice(-3000)}` : excerpt,
  }
}

export async function diagnoseAuthenticated500s() {
  const reports = readdirSync(folder)
    .filter((name) =>
      /^UE_V2_ROUTE_BUCKET_EXECUTION\.(HTTP_GET_NEEDS_EXPLICIT_FIXTURE|READ_ONLY_FALSE_POSITIVE_GET|HTTP_SHARED_GUARD_MUTATION|HTTP_MUTATION_NEEDS_EXPLICIT_FIXTURE)\.json$/.test(
        name,
      ),
    )
    .map((name) => ({
      file: name,
      report: JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as BucketReport,
    }))
  const failing = reports.flatMap(({ file, report }) =>
    report.receipts
      .filter((receipt) =>
        receipt.cases.some(
          (test) => test.name === 'authenticated' && test.outcome === 'FAIL' && test.status === 500,
        ),
      )
      .map((receipt) => ({ ...receipt, bucketFile: file })),
  )

  const plan: V2Plan = await buildPlan(process.env.UE_V2_WHEELHOUSE!)
  const fixture = await openNativeRuntimeFixture(plan, { auth: true })
  const statePath = path.join(path.resolve('artifacts'), `ue-v2-diagnostics-${randomUUID()}`)
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
  try {
    const build = launch(['build', '--webpack'])
    child = build.process
    const buildExitCode = await new Promise<number | null>((resolve, reject) => {
      child!.once('error', reject)
      child!.once('close', resolve)
    })
    assert.equal(buildExitCode, 0, 'UE_V2_DIAGNOSTIC_BUILD_FAILED')

    const server = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)])
    child = server.process
    for (let attempt = 0; attempt < 120; attempt++) {
      assert.equal(child.exitCode, null, 'UE_V2_DIAGNOSTIC_SERVER_EXITED')
      if (server.output().includes('Ready in')) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    assert.match(server.output(), /Ready in/, 'UE_V2_DIAGNOSTIC_SERVER_NOT_READY')
    const base = `http://127.0.0.1:${port}`
    const seeded = await import('./next-http-smoke').then((module) =>
      module.seedNextHttpSmoke(fixture.seed, env.AUTH_MFA_ENCRYPTION_KEY!),
    )
    const memberCookie = await selectOrganization(
      base,
      await login(base, `${seeded.actor}@example.invalid`, seeded.password, seeded.mfaSecret),
      seeded.organizations[0],
    )
    const adminCookie = await selectOrganization(
      base,
      await login(
        base,
        `${seeded.administrator}@example.invalid`,
        seeded.password,
        seeded.mfaSecret,
      ),
      seeded.organizations[0],
    )

    const diagnostics: Diagnostic[] = []
    for (const receipt of failing) {
      const source = readFileSync(path.join(root, ...receipt.sourcePath.split('/')), 'utf8')
      const cookie = chooseCookie(receipt.sourcePath, source, memberCookie, adminCookie)
      const result = await invokeWithDiagnostics(server.output, base, receipt, cookie)
      diagnostics.push(parseDiagnostic(receipt, result.status, result.bodyText, result.excerpt))
    }

    const grouped = new Map<
      string,
      {
        key: string
        sqlstate: string | null
        relation: string | null
        column: string | null
        role: string | null
        errorText: string
        routes: string[]
      }
    >()
    for (const diagnostic of diagnostics) {
      const key = [
        diagnostic.sqlstate ?? 'NO_SQLSTATE',
        diagnostic.relation ?? 'NO_RELATION',
        diagnostic.column ?? 'NO_COLUMN',
        diagnostic.role ?? 'NO_ROLE',
        diagnostic.errorText,
      ].join('|')
      const current = grouped.get(key) ?? {
        key,
        sqlstate: diagnostic.sqlstate,
        relation: diagnostic.relation,
        column: diagnostic.column,
        role: diagnostic.role,
        errorText: diagnostic.errorText,
        routes: [],
      }
      current.routes.push(diagnostic.id)
      grouped.set(key, current)
    }
    const groupedCauses = [...grouped.values()]
      .map((cause) => ({ ...cause, routeCount: cause.routes.length }))
      .sort(
        (left, right) => right.routeCount - left.routeCount || left.key.localeCompare(right.key),
      )
    const output = {
      generatedAt: new Date().toISOString(),
      totalRoutes: diagnostics.length,
      groupedCauses,
      diagnostics,
    }
    writeFileSync(
      path.join(folder, 'UE_V2_AUTHENTICATED_500_DIAGNOSTICS.json'),
      JSON.stringify(output, null, 2) + '\n',
    )
    return output
  } finally {
    await stop(child)
    await vault.dispose()
    await fixture.dispose()
    rmSync(statePath, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  diagnoseAuthenticated500s()
    .then((output) => process.stdout.write(`${JSON.stringify(output)}\n`))
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
