/** Existing O02/O03 profile on the owned disposable HTTP fixture. No staging URL, cookie or case content is persisted. */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import pg from 'pg'
import type { Client } from 'pg'
import { withBearerOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { DEFAULT_ISSUANCE_TEMPLATES } from '../../lib/authority/issuance'
import { activeMembershipSource } from '../../lib/authority/store/active-membership-source'
import { CANONICAL_ORGANIZATION_AUTHORITY } from '../../lib/auth/organization-authority'
import { runAuthorityTransaction, type AuthorityContext, type SqlExecutor } from '../../lib/authority/store/executor'
import {
  activateIssuanceRule,
  draftIssuanceRule,
  requestRuleAdoption,
  requestIssuanceApproval,
  issueMandate,
  acceptInstrument,
  assignCase,
} from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'

export const AUTHENTICATED_CASEWORK_PROFILE = {
  warmupSeconds: 10,
  warmupRequestsPerSecond: 5,
  stages: [
    { concurrency: 1, durationSeconds: 60, requestsPerSecond: 5 },
    { concurrency: 5, durationSeconds: 180, requestsPerSecond: 20 },
  ],
  minimumScheduledThroughputRatio: 0.95,
  p95Ms: 500,
  p99Ms: 1500,
  errorRate: 0,
  maxRequests: 10000,
} as const
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const roles = [
  'member',
  'steward',
  'chief_steward',
  'president',
  'vice_president',
  'secretary_treasurer',
] as const
export interface OwnedLoadFixture {
  ownership: string
  organizationId: string
  foreignOrganizationId: string
  people: Record<(typeof roles)[number], { id: string; email: string }>
  memberCaseId: string
  assignedCaseId: string
  foreignCaseId: string
}
export function assertOwnedLocalOrigin(origin: string) {
  const url = new URL(origin)
  assert.equal(url.protocol, 'http:', 'Disposable HTTP only')
  assert.equal(url.hostname, '127.0.0.1', 'Owned localhost only')
  assert.ok(url.port && Number(url.port) > 1024, 'Ephemeral localhost port required')
  assert.equal(url.username, '')
  assert.equal(url.password, '')
  assert.equal(url.pathname, '/')
  assert.equal(url.search, '')
  assert.equal(url.hash, '')
  return url.origin
}
function assertOwnedDatabase(url: string) {
  const parsed = new URL(url)
  assert.equal(parsed.protocol, 'postgresql:')
  assert.equal(parsed.hostname, '127.0.0.1')
  assert.ok(parsed.port)
}
export async function seedAuthenticatedCaseworkFixtures(
  seed: Client,
  input: {
    organizationId: string
    foreignOrganizationId: string
    passwordHash: string
    encryptedMfaSecret: string
  },
): Promise<OwnedLoadFixture> {
  assert.ok(
    UUID.test(input.organizationId) &&
      UUID.test(input.foreignOrganizationId) &&
      input.organizationId !== input.foreignOrganizationId,
  )
  const people = {} as OwnedLoadFixture['people']
  for (const role of roles) {
    const id = randomUUID(),
      email = `ue-load-${role}-${id}@example.invalid`
    people[role] = { id, email }
    await seed.query(
      "INSERT INTO user_management.users(user_id,email,password_hash,is_active,lifecycle_state) VALUES($1,$2,$3,true,'active')",
      [id, email, input.passwordHash],
    )
    await seed.query(
      'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_primary,is_active,joined_at) VALUES($1,$2,$3,true,true,now())',
      [id, input.organizationId, role],
    )
    await seed.query(
      'INSERT INTO user_management.mfa_totp(user_id,secret_encrypted,enabled_at) VALUES($1,$2,now())',
      [id, input.encryptedMfaSecret],
    )
  }
  // A legitimate membership in a second tenant still cannot be used through the
  // primary-tenant HTTP session. The foreign case is not an orphaned fixture.
  await seed.query(
    "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_primary,is_active,joined_at) VALUES($1,$2,'member',false,true,now())",
    [people.member.id, input.foreignOrganizationId],
  )
  const fixture: OwnedLoadFixture = {
    ownership: randomUUID(),
    organizationId: input.organizationId,
    foreignOrganizationId: input.foreignOrganizationId,
    people,
    memberCaseId: randomUUID(),
    assignedCaseId: randomUUID(),
    foreignCaseId: randomUUID(),
  }
  for (const [caseId, org] of [
    [fixture.memberCaseId, input.organizationId],
    [fixture.assignedCaseId, input.organizationId],
    [fixture.foreignCaseId, input.foreignOrganizationId],
  ])
    await seed.query(
      `INSERT INTO public.claims(id,claim_id,organization_id,member_id,claim_number,claim_type,status,priority,description,is_anonymous,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,'workplace_safety','submitted','low','Owned synthetic authenticated load fixture',false,now(),now())`,
      [
        randomUUID(),
        caseId,
        org,
        people.member.id,
        `LOAD-${fixture.ownership.slice(0, 8)}-${caseId.slice(0, 8)}`,
      ],
    )
  return fixture
}
interface Principal {
  role: 'member' | 'steward'
  cookie: string
  caseId: string
  userId: string
  representedMemberUserId: string
  organizationId: string
}
interface Failure {
  kind: string
  status: number | null
}
export interface StageResult {
  concurrency: number
  durationSeconds: number
  requestsPerSecond: number
  scheduledRequests: number
  requests: number
  skipped: number
  errors: number
  errorRate: number
  scheduledThroughputRatio: number
  p50Ms: number
  p90Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  latencyBuckets: Record<string, number>
  actualDurationSeconds: number
  sampleSha256: string
  failureMetadata: Failure[]
  passed: boolean
}
export function percentile(sorted: readonly number[], fraction: number): number {
  if (!sorted.length) return Number.POSITIVE_INFINITY
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)]
}
export function assessStage(samples: readonly number[], errors: number, scheduledRequests: number) {
  const sorted = [...samples].sort((a, b) => a - b),
    p95Ms = percentile(sorted, 0.95),
    p99Ms = percentile(sorted, 0.99)
  const ratio = samples.length / scheduledRequests,
    errorRate = samples.length ? errors / samples.length : 1
  const latencyBuckets = { '<=100ms': 0, '101-500ms': 0, '501-1500ms': 0, '>1500ms': 0 }
  for (const sample of sorted)
    latencyBuckets[
      sample <= 100
        ? '<=100ms'
        : sample <= 500
          ? '101-500ms'
          : sample <= 1500
            ? '501-1500ms'
            : '>1500ms'
    ]++
  return {
    p50Ms: percentile(sorted, 0.5),
    p90Ms: percentile(sorted, 0.9),
    p95Ms,
    p99Ms,
    maxMs: sorted.at(-1) ?? Number.POSITIVE_INFINITY,
    latencyBuckets,
    errorRate,
    scheduledThroughputRatio: ratio,
    passed:
      ratio >= AUTHENTICATED_CASEWORK_PROFILE.minimumScheduledThroughputRatio &&
      p95Ms <= AUTHENTICATED_CASEWORK_PROFILE.p95Ms &&
      p99Ms <= AUTHENTICATED_CASEWORK_PROFILE.p99Ms &&
      errorRate === AUTHENTICATED_CASEWORK_PROFILE.errorRate,
  }
}
function caseData(raw: unknown): Record<string, unknown> {
  let value = raw
  for (let i = 0; i < 3; i++) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const row = value as Record<string, unknown>
      if (typeof row.claimId === 'string') return row
      value = row.data
    } else break
  }
  throw new Error('CASE_RESPONSE_SHAPE')
}
export function assertCaseProjection(
  raw: unknown,
  principal: Pick<Principal, 'caseId' | 'organizationId' | 'representedMemberUserId'>,
) {
  const row = caseData(raw)
  assert.equal(row.claimId, principal.caseId, 'CASE_RESOURCE_SUBSTITUTION')
  assert.equal(row.organizationId, principal.organizationId, 'CASE_TENANT_SUBSTITUTION')
  assert.equal(row.memberId, principal.representedMemberUserId, 'CASE_SUBJECT_SUBSTITUTION')
}
async function jsonRequest(
  base: string,
  path: string,
  options: { cookie?: string; body?: unknown; method?: string } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    headers: {
      origin: base,
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const text = await response.text()
  assert.ok(text.length <= 1024 * 1024, 'BOUND_RESPONSE_TOO_LARGE')
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error('NON_JSON_RESPONSE')
  }
  return { response, body }
}
export async function login(
  base: string,
  person: { id: string; email: string },
  password: string,
  mfaSecret: string,
  organizationId: string,
) {
  assertOwnedLocalOrigin(base)
  assert.ok(UUID.test(organizationId), 'OWNED_ORGANIZATION_REQUIRED')
  const initial = await jsonRequest(base, '/api/auth/login', {
    method: 'POST',
    body: { email: person.email, password },
  })
  assert.equal(initial.response.status, 200, 'OWNED_LOGIN_FAILED')
  const result = initial.body as Record<string, unknown>
  assert.equal(result.requiresMfa, true, 'REAL_MFA_CHALLENGE_REQUIRED')
  assert.equal(typeof result.mfaChallengeToken, 'string')
  const mfa = await jsonRequest(base, '/api/auth/mfa/challenge', {
    method: 'POST',
    body: { challengeToken: result.mfaChallengeToken, code: computeTotp(mfaSecret) },
  })
  assert.equal(mfa.response.status, 200, 'OWNED_MFA_FAILED')
  assert.equal((mfa.body as Record<string, unknown>).ok, true, 'OWNED_MFA_CONFIRMATION_REQUIRED')
  assert.equal((mfa.body as Record<string, unknown>).userId, person.id)
  const cookie = mfa.response.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')
  assert.ok(cookie.includes('nzila_session='), 'REAL_SESSION_COOKIE_REQUIRED')
  const selected = await jsonRequest(base, '/api/organizations/switch', {
    method: 'POST', cookie, body: { organizationId },
  })
  assert.equal(selected.response.status, 200, 'OWNED_ORGANIZATION_SELECTION_FAILED')
  const selection = selected.body as Record<string, unknown>
  assert.equal(selection.success, true, 'OWNED_ORGANIZATION_CONFIRMATION_REQUIRED')
  assert.equal(selection.organizationAuthority, CANONICAL_ORGANIZATION_AUTHORITY)
  assert.equal(selection.activeOrganizationId, organizationId, 'OWNED_ORGANIZATION_SUBSTITUTED')
  assert.ok(selection.organization && typeof selection.organization === 'object' &&
    'id' in selection.organization && selection.organization.id === organizationId, 'OWNED_ORGANIZATION_METADATA_SUBSTITUTED')
  const boundCookie = selected.response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  assert.ok(boundCookie.includes('nzila_session='), 'ROTATED_BOUND_SESSION_REQUIRED')
  assert.notEqual(boundCookie, cookie, 'UNBOUND_SESSION_MUST_BE_ROTATED')
  return boundCookie
}
/** Dedicated NOINHERIT fixture connection; keep the role inside its owned transaction. */
export async function runOwnedRuntimeAuthorityTransaction<T>(
  connection: SqlExecutor,
  context: AuthorityContext,
  operation: (executor: SqlExecutor) => Promise<T>,
) {
  return runAuthorityTransaction(connection, context, async (executor) => {
    await executor.query('SET LOCAL ROLE union_eyes_runtime')
    return operation(executor)
  })
}

export async function governPrimaryAssignment(input: {
  fixture: OwnedLoadFixture
  cookies: Map<string, string>
  runtimeUrl: string
  authUrl: string
}) {
  assertOwnedDatabase(input.runtimeUrl)
  assertOwnedDatabase(input.authUrl)
  const previousAuth = process.env.AUTH_DATABASE_URL,
    previousMode = process.env.UE_CANONICAL_BOOTSTRAP_V2
  process.env.AUTH_DATABASE_URL = input.authUrl
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  const deps = { memberships: activeMembershipSource }
  const { fixture: f } = input
  const as = async <T>(
    role: (typeof roles)[number],
    operation: (exec: SqlExecutor) => Promise<T>,
  ) => {
    const cookie = input.cookies.get(role)!
    const raw = cookie
      .split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('nzila_session='))
      ?.slice('nzila_session='.length)
    assert.ok(raw, 'OWNED_AUTHENTICATED_COOKIE_REQUIRED')
    return withBearerOrgBinding(
      decodeURIComponent(raw),
      { organizationId: f.organizationId, expectedActorUserId: f.people[role].id },
      async (binding) => {
        const client = new pg.Client({ connectionString: input.runtimeUrl })
        await client.connect()
        try {
          return await runOwnedRuntimeAuthorityTransaction(
            client,
            {
              organizationId: binding.organizationId,
              userId: binding.userId,
              sessionToken: binding.sessionToken,
            },
            operation,
          )
        } finally {
          await client.end()
        }
      },
    )
  }
  try {
    for (const domain of ['supervisory', 'case_assignment'] as const) {
      const template = DEFAULT_ISSUANCE_TEMPLATES.find(
        (t) => t.domain === domain && t.operation === 'issue',
      )!
      const ruleId = await as('president', (tx) =>
        draftIssuanceRule(tx, deps, {
          ...template,
          organizationId: f.organizationId,
          draftedBy: f.people.president.id,
        }),
      )
      const request = await as('president', (tx) =>
        requestRuleAdoption(tx, deps, {
          organizationId: f.organizationId,
          ruleId,
          actorUserId: f.people.president.id,
          sourceInstrument: `Owned disposable load fixture ${f.ownership}; synthetic resolution only`,
          namedApproverIds: [f.people.vice_president.id, f.people.secretary_treasurer.id],
        }),
      )
      for (const role of ['vice_president', 'secretary_treasurer'] as const)
        await as(role, (tx) =>
          recordApprovalDecision(tx, deps, {
            organizationId: f.organizationId,
            approvalRequestId: request,
            approverUserId: f.people[role].id,
            decision: 'approved',
          }),
        )
      await as('vice_president', (tx) =>
        activateIssuanceRule(tx, deps, {
          organizationId: f.organizationId,
          ruleId,
          actorUserId: f.people.vice_president.id,
          approvalRequestId: request,
        }),
      )
    }
    const mandateId = randomUUID(),
      effectiveAt = new Date(Date.now() - 1000),
      expiresAt = new Date(Date.now() + 60 * 60_000)
    const grant = {
      id: mandateId,
      organizationId: f.organizationId,
      issuerUserId: f.people.president.id,
      holderUserId: f.people.chief_steward.id,
      kind: 'supervisory' as const,
      powers: ['read', 'assign'],
      scope: { resourceIds: [f.assignedCaseId] },
      sourceInstrument: `Owned synthetic fixture ${f.ownership}`,
      effectiveAt,
      expiresAt,
    }
    const request = await as('president', (tx) =>
      requestIssuanceApproval(tx, deps, {
        ...grant,
        instrumentId: mandateId,
        namedApproverIds: [f.people.secretary_treasurer.id],
      }),
    )
    await as('secretary_treasurer', (tx) =>
      recordApprovalDecision(tx, deps, {
        organizationId: f.organizationId,
        approvalRequestId: request,
        approverUserId: f.people.secretary_treasurer.id,
        decision: 'approved',
      }),
    )
    await as('president', (tx) => issueMandate(tx, deps, { ...grant, approvalRequestId: request }))
    await as('chief_steward', (tx) =>
      acceptInstrument(tx, {
        organizationId: f.organizationId,
        instrumentType: 'mandate',
        instrumentId: mandateId,
        holderUserId: f.people.chief_steward.id,
      }),
    )
    return await as('chief_steward', (tx) =>
      assignCase(tx, deps, {
        organizationId: f.organizationId,
        issuerUserId: f.people.chief_steward.id,
        caseId: f.assignedCaseId,
        assigneeUserId: f.people.steward.id,
        effectiveAt,
        expiresAt,
      }),
    )
  } finally {
    if (previousAuth === undefined) delete process.env.AUTH_DATABASE_URL
    else process.env.AUTH_DATABASE_URL = previousAuth
    if (previousMode === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousMode
  }
}
export async function runScheduledStage(
  base: string,
  principals: Principal[],
  stage: { concurrency: number; durationSeconds: number; requestsPerSecond: number },
  budget: { remaining: number },
): Promise<StageResult> {
  assertOwnedLocalOrigin(base)
  assert.ok(
    principals.length > 0 &&
      stage.concurrency > 0 &&
      Number.isInteger(stage.concurrency) &&
      stage.durationSeconds > 0 &&
      stage.requestsPerSecond > 0,
    'BOUNDED_SCHEDULE_REQUIRED',
  )
  const samples: number[] = [],
    failures: Failure[] = []
  let errors = 0,
    skipped = 0,
    sequence = 0
  const inflight = new Set<Promise<void>>()
  const start = performance.now(),
    scheduledRequests = Math.round(stage.durationSeconds * stage.requestsPerSecond),
    interval = 1000 / stage.requestsPerSecond
  for (let scheduled = 0; scheduled < scheduledRequests; scheduled++) {
    const delay = start + scheduled * interval - performance.now()
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    if (
      performance.now() >= start + stage.durationSeconds * 1000 ||
      inflight.size >= stage.concurrency ||
      budget.remaining <= 0
    ) {
      skipped++
      continue
    }
    budget.remaining--
    const principal = principals[sequence++ % principals.length]
    const task = (async () => {
      const began = performance.now()
      let status: number | null = null
      try {
        const result = await jsonRequest(base, `/api/cases/${principal.caseId}`, {
          cookie: principal.cookie,
        })
        status = result.response.status
        assert.equal(status, 200, 'CASE_READ_HTTP_ERROR')
        assertCaseProjection(result.body, principal)
      } catch (error) {
        errors++
        if (failures.length < 25)
          failures.push({
            kind:
              error instanceof Error && /SUBSTITUTION|CASE_RESPONSE_SHAPE/.test(error.message)
                ? 'RESOURCE_OR_TENANT_BOUNDARY'
                : 'REQUEST_OR_RESPONSE_FAILURE',
            status,
          })
      } finally {
        samples.push(performance.now() - began)
      }
    })()
    inflight.add(task)
    void task.finally(() => inflight.delete(task))
  }
  await Promise.all(inflight)
  const assessed = assessStage(samples, errors, scheduledRequests)
  return {
    ...stage,
    scheduledRequests,
    requests: samples.length,
    skipped,
    errors,
    ...assessed,
    actualDurationSeconds: (performance.now() - start) / 1000,
    sampleSha256: digest(samples),
    failureMetadata: failures,
  }
}
export async function runAuthenticatedCaseworkLoad(input: {
  origin: string
  seed: Client
  fixture: OwnedLoadFixture
  password: string
  mfaSecret: string
  runtimeUrl: string
  authUrl: string
}) {
  const base = assertOwnedLocalOrigin(input.origin),
    f = input.fixture
  assert.ok(UUID.test(f.ownership))
  assertOwnedDatabase(input.runtimeUrl)
  assertOwnedDatabase(input.authUrl)
  const source = await input.seed.query(
    `SELECT c.claim_id::text,c.organization_id::text,c.member_id FROM public.claims c WHERE c.claim_id=ANY($1::uuid[])`,
    [[f.memberCaseId, f.assignedCaseId, f.foreignCaseId]],
  )
  assert.equal(source.rowCount, 3, 'PRODUCER_VERIFIED_OWNED_CASES_REQUIRED')
  for (const row of source.rows) {
    assert.equal(row.member_id, f.people.member.id)
    assert.equal(
      row.organization_id,
      row.claim_id === f.foreignCaseId ? f.foreignOrganizationId : f.organizationId,
    )
  }
  const cookies = new Map<string, string>()
  for (const role of roles)
    cookies.set(role, await login(base, f.people[role], input.password, input.mfaSecret, f.organizationId))
  const relationshipId = await governPrimaryAssignment({
    fixture: f,
    cookies,
    runtimeUrl: input.runtimeUrl,
    authUrl: input.authUrl,
  })
  const durable = await input.seed.query(
    `SELECT organization_id::text,resource_id::text,principal_user_id::text,origin,relation FROM ue_authority_resource_relationships WHERE id=$1`,
    [relationshipId],
  )
  assert.deepEqual(durable.rows, [
    {
      organization_id: f.organizationId,
      resource_id: f.assignedCaseId,
      principal_user_id: f.people.steward.id,
      origin: 'explicit',
      relation: 'assignee',
    },
  ])
  const principals: Principal[] = [
    {
      role: 'member',
      cookie: cookies.get('member')!,
      caseId: f.memberCaseId,
      userId: f.people.member.id,
      representedMemberUserId: f.people.member.id,
      organizationId: f.organizationId,
    },
    {
      role: 'steward',
      cookie: cookies.get('steward')!,
      caseId: f.assignedCaseId,
      userId: f.people.steward.id,
      representedMemberUserId: f.people.member.id,
      organizationId: f.organizationId,
    },
  ]
  const probe = async () => {
    for (const principal of principals) {
      const allowed = await jsonRequest(base, `/api/cases/${principal.caseId}`, {
        cookie: principal.cookie,
      })
      assert.equal(allowed.response.status, 200)
      assertCaseProjection(allowed.body, principal)
      const foreign = await jsonRequest(base, `/api/cases/${f.foreignCaseId}`, {
        cookie: principal.cookie,
      })
      assert.ok([403, 404].includes(foreign.response.status), 'CROSS_TENANT_CASE_DENIAL_REQUIRED')
      assert.ok(
        !JSON.stringify(foreign.body).includes(f.foreignCaseId),
        'DENIED_CASE_METADATA_DISCLOSED',
      )
    }
  }
  await probe()
  const budget = { remaining: AUTHENTICATED_CASEWORK_PROFILE.maxRequests }
  const warmup = await runScheduledStage(
    base,
    principals,
    {
      concurrency: 1,
      durationSeconds: AUTHENTICATED_CASEWORK_PROFILE.warmupSeconds,
      requestsPerSecond: AUTHENTICATED_CASEWORK_PROFILE.warmupRequestsPerSecond,
    },
    budget,
  )
  const stages = []
  for (const stage of AUTHENTICATED_CASEWORK_PROFILE.stages)
    stages.push(await runScheduledStage(base, principals, stage, budget))
  await probe()
  return {
    status: warmup.errors === 0 && stages.every((s) => s.passed) ? 'PASS' : 'FAIL',
    profile: AUTHENTICATED_CASEWORK_PROFILE,
    warmup,
    stages,
    thresholdsRelaxed: false,
    environment: 'OWNED_DISPOSABLE_LOCALHOST_NEXT_AND_CANONICAL_POSTGRESQL',
    sourceFixturesVerified: true,
    governedPrimaryAssignmentVerified: true,
    tenantDenialsBeforeAndAfter: true,
    roles: ['member', 'steward'],
    profileDigest: digest(AUTHENTICATED_CASEWORK_PROFILE),
    credentialOrCaseContentPersisted: false,
    scope:
      'Bounded authenticated GET casework profile; not real Entra, full pilot soak, live customer acceptance or ecosystem completion.',
  }
}
