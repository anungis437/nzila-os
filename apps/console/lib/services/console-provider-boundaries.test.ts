import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { decryptToken, encryptToken } from '../qbo-token-crypto'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
  exchange: vi.fn(),
  revoke: vi.fn(),
  qboReport: vi.fn(),
  blob: vi.fn(),
  subscription: vi.fn(),
  portal: vi.fn(),
  refund: vi.fn(),
  normalize: vi.fn(),
  markFailed: vi.fn(),
  findConnection: vi.fn(),
  findToken: vi.fn(),
  members: [] as Array<{ orgId: string; userId: string; role: string; status: string }>,
  rows: {} as Record<string, unknown[][]>,
  queries: [] as Array<{ table: string; filter?: SQL }>,
  writes: [] as Array<{
    executor: string
    table: string
    operation: string
    value: Record<string, unknown>
    filter?: SQL
  }>,
  failTable: '',
  rollbacks: 0,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }))
vi.mock('next/headers', () => ({ headers: m.headers }))
vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: m.select,
    insert: m.insert,
    update: m.update,
    transaction: m.transaction,
    query: {
      qboConnections: { findFirst: m.findConnection },
      qboTokens: { findFirst: m.findToken },
    },
  },
}))
vi.mock('@nzila/db/client', () => ({
  db: { select: m.select, insert: m.insert, update: m.update },
}))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
}))
vi.mock('@/lib/audit-db', () => ({ recordAuditEvent: m.audit }))
vi.mock('@nzila/qbo/oauth', async (original) => ({
  ...(await original<typeof import('@nzila/qbo/oauth')>()),
  exchangeCodeForTokens: m.exchange,
  revokeToken: m.revoke,
}))
vi.mock('@nzila/qbo/client', () => ({ createQboClient: () => ({ report: m.qboReport }) }))
vi.mock('@nzila/blob', () => ({ uploadBuffer: m.blob }))
vi.mock('@nzila/payments-stripe/primitives', async (original) => ({
  ...(await original<typeof import('@nzila/payments-stripe/primitives')>()),
  createSubscription: m.subscription,
  createPortalSession: m.portal,
  executeRefund: m.refund,
}))
vi.mock('@nzila/payments-stripe', async (original) => ({
  ...(await original<typeof import('@nzila/payments-stripe')>()),
  normalizeAndPersist: m.normalize,
  markEventFailed: m.markFailed,
}))

const org = '11111111-1111-4111-8111-111111111111',
  foreign = '22222222-2222-4222-8222-222222222222',
  paymentId = '33333333-3333-4333-8333-333333333333',
  refundId = '44444444-4444-4444-8444-444444444444'
const userId = 'canonical-non-uuid-billing-operator'
const dialect = new PgDialect()
const request = (body: object, method = 'POST') =>
  new NextRequest('https://console.test/api', { method, body: JSON.stringify(body) })
const callback = (organization = org, cookie = 'synthetic-csrf') =>
  new NextRequest(
    'https://console.test/api/qbo/callback?code=synthetic-code&realmId=synthetic-realm&state=' +
      Buffer.from(JSON.stringify({ csrfToken: 'synthetic-csrf', orgId: organization })).toString(
        'base64url',
      ),
    { headers: { cookie: 'qbo_oauth_state=' + cookie } },
  )

function mutations(executor: string) {
  return {
    insert: (table: Parameters<typeof getTableName>[0]) => ({
      values: (value: Record<string, unknown>) => {
        const name = getTableName(table)
        m.writes.push({ executor, table: name, operation: 'insert', value })
        if (name === m.failTable) throw new Error('owned fixture persistence failure')
        return {
          returning: async () => [{ id: 'created-row', ...value }],
          then: (resolve: (value: undefined) => unknown) =>
            Promise.resolve(undefined).then(resolve),
        }
      },
    }),
    update: (table: Parameters<typeof getTableName>[0]) => ({
      set: (value: Record<string, unknown>) => ({
        where: async (filter: SQL) => {
          m.writes.push({
            executor,
            table: getTableName(table),
            operation: 'update',
            value,
            filter,
          })
        },
      }),
    }),
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AI_SERVICE_KEY', '')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', '01'.repeat(32))
  vi.stubEnv('AZURE_KEYVAULT_URL', undefined)
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_fixture')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture')
  vi.stubEnv('STRIPE_ENVIRONMENT', 'test')
  vi.stubEnv('STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS', '50000')
  m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
  m.currentUser.mockResolvedValue(null)
  m.headers.mockResolvedValue(new Headers())
  m.members = [{ orgId: org, userId, role: 'org_admin', status: 'active' }]
  m.rows = {}
  m.queries = []
  m.writes = []
  m.failTable = ''
  m.rollbacks = 0
  m.audit.mockResolvedValue(undefined)
  m.normalize.mockResolvedValue({ kind: 'fixture' })
  m.markFailed.mockResolvedValue(undefined)
  m.exchange.mockResolvedValue({
    access_token: 'synthetic-access',
    refresh_token: 'synthetic-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    x_refresh_token_expires_in: 86400,
    realmId: 'synthetic-realm',
    obtainedAt: Date.now(),
  })
  m.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table),
        data = m.rows[name]?.shift() ?? [],
        observation: (typeof m.queries)[number] = { table: name }
      m.queries.push(observation)
      const chain = {
        where: (filter: SQL) => {
          observation.filter = filter
          return chain
        },
        limit: () => chain,
        orderBy: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => {
          const params = observation.filter ? dialect.sqlToQuery(observation.filter).params : []
          const rows =
            name === 'org_members'
              ? m.members.filter(
                  (member) =>
                    member.orgId === params[0] &&
                    member.userId === params[1] &&
                    member.status === params[2],
                )
              : data
          return Promise.resolve(rows).then(resolve)
        },
      }
      return chain
    },
  }))
  const direct = mutations('direct')
  m.insert.mockImplementation(direct.insert)
  m.update.mockImplementation(direct.update)
  m.transaction.mockImplementation(
    async (fn: (tx: ReturnType<typeof mutations>) => Promise<void>) => {
      const before = [...m.writes]
      try {
        await fn(mutations('transaction'))
      } catch (error) {
        m.writes = before
        m.rollbacks++
        throw error
      }
    },
  )
  m.findConnection.mockResolvedValue(null)
  m.findToken.mockResolvedValue(null)
  m.subscription.mockResolvedValue({
    subscriptionId: 'sub_fixture',
    clientSecret: 'synthetic-client-reference',
    status: 'incomplete',
    currentPeriodEnd: null,
  })
  m.portal.mockResolvedValue({ url: 'https://billing.example.invalid/owned-fixture' })
  m.refund.mockResolvedValue({ id: 'refund_fixture', status: 'succeeded' })
  m.revoke.mockResolvedValue(undefined)
  m.qboReport.mockResolvedValue({ Header: { ReportName: 'TrialBalance' } })
  m.blob.mockResolvedValue({ blobPath: 'synthetic-stored-path' })
})
afterEach(() => vi.unstubAllEnvs())

describe('QBO callback and persistence keep actual live organization authority', () => {
  it('retains CSRF denial before organization queries or token exchange', async () => {
    const { GET } = await import('../../app/api/qbo/callback/route')
    const response = await GET(callback(org, 'wrong-cookie'))
    expect(response.headers.get('location')).toContain('csrf_mismatch')
    expect(m.queries).toEqual([])
    expect(m.exchange).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
  })
  it('denies edited foreign state organization and revoked org-admin role before exchange or writes', async () => {
    const { GET } = await import('../../app/api/qbo/callback/route')
    expect((await GET(callback(foreign))).status).toBe(403)
    m.members[0].role = 'org_secretary'
    expect((await GET(callback())).status).toBe(403)
    expect(m.exchange).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.writes).toEqual([])
  })
  it('rejects missing production encryption even with AzureURL before exchanging or persisting tokens', async () => {
    const { GET } = await import('../../app/api/qbo/callback/route')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AZURE_KEYVAULT_URL', 'https://owned-vault.invalid')
    vi.stubEnv('QBO_TOKEN_ENCRYPTION_KEY', '')
    expect((await GET(callback())).headers.get('location')).toContain('token_storage_unavailable')
    expect(m.exchange).not.toHaveBeenCalled()
    expect(m.transaction).not.toHaveBeenCalled()
    expect(m.writes).toEqual([])
  })
  it('keeps one transaction for replacement connection and real encrypted token writes with canonical actor', async () => {
    const { GET } = await import('../../app/api/qbo/callback/route')
    const response = await GET(callback())
    expect(response.headers.get('location')).toContain('qbo=connected')
    expect(response.headers.get('set-cookie')).toContain('qbo_oauth_state=;')
    expect(m.transaction).toHaveBeenCalledTimes(1)
    expect(m.writes.map((w) => [w.executor, w.table])).toEqual([
      ['transaction', 'qbo_connections'],
      ['transaction', 'qbo_connections'],
      ['transaction', 'qbo_tokens'],
    ])
    expect(m.writes[1].value).toMatchObject({
      orgId: org,
      realmId: 'synthetic-realm',
      connectedBy: userId,
    })
    const ciphertext = String(m.writes[2].value.accessToken)
    expect(ciphertext.startsWith('enc:v1:')).toBe(true)
    expect(decryptToken(ciphertext)).toBe('synthetic-access')
  })
  it('does not fall back to direct writes when the original transaction fails', async () => {
    const { GET } = await import('../../app/api/qbo/callback/route')
    m.failTable = 'qbo_tokens'
    await expect(GET(callback())).rejects.toThrow('owned fixture persistence failure')
    expect(m.rollbacks).toBe(1)
    expect(m.writes).toEqual([])
  })
  it('connection status projects expiry metadata without OAuth bearer secrets', async () => {
    const { GET } = await import('../../app/api/qbo/status/route')
    m.findConnection.mockResolvedValue({
      id: 'connection',
      realmId: 'realm',
      companyName: 'Synthetic company',
      connectedAt: new Date(),
      connectedBy: userId,
    })
    m.findToken.mockResolvedValue({
      accessToken: 'MUST_NOT_RETURN_SYNTHETIC_TOKEN',
      refreshToken: 'MUST_NOT_RETURN_SYNTHETIC_REFRESH',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
    })
    const response = await GET(new NextRequest('https://console.test/api?orgId=' + org))
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).not.toContain('MUST_NOT_RETURN')
  })
  it('sync preserves source organization, encrypted credential use and report/blob failure status', async () => {
    const { POST } = await import('../../app/api/qbo/sync/route')
    const now = Date.now()
    m.findConnection.mockResolvedValue({ id: 'connection', realmId: 'realm' })
    m.findToken.mockResolvedValue({
      accessToken: encryptToken('synthetic-access'),
      refreshToken: encryptToken('synthetic-refresh'),
      accessTokenExpiresAt: new Date(now + 3600_000),
      refreshTokenExpiresAt: new Date(now + 86400_000),
      createdAt: new Date(now),
    })
    m.blob.mockRejectedValueOnce(new Error('owned blob fixture unavailable'))
    const response = await POST(request({ orgId: org, reportType: 'trial_balance' }))
    expect(response.status).toBe(502)
    expect(m.qboReport).toHaveBeenCalledWith('TrialBalance', {})
    expect(m.writes.at(-1)).toMatchObject({ table: 'qbo_sync_runs', value: { status: 'failed' } })
    expect(dialect.sqlToQuery(m.writes.at(-1)!.filter!).params).toEqual(['created-row', org])
  })
})

describe('existing Stripe management keeps current guard, threshold and scope contracts', () => {
  it.each([
    {
      name: 'portal',
      body: { orgId: org, customerId: 'customer', returnUrl: 'https://console.test/return' },
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/stripe/customer-portal/route')).POST(r),
    },
    {
      name: 'subscription',
      body: { orgId: org, customerId: 'customer', priceId: 'price' },
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/stripe/subscriptions/route')).POST(r),
    },
    {
      name: 'refund',
      body: { orgId: org, paymentId, amountCents: 100 },
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/stripe/refunds/route')).POST(r),
    },
    {
      name: 'approval',
      body: { orgId: org, refundId, action: 'approve' },
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/stripe/refunds/approve/route')).POST(r),
    },
  ])('$name rejects anonymous before SQL or provider action', async (route) => {
    m.auth.mockResolvedValue({ userId: null })
    expect((await route.invoke(request(route.body))).status).toBe(401)
    expect(m.queries).toEqual([])
    expect(m.writes).toEqual([])
    expect(m.subscription).not.toHaveBeenCalled()
    expect(m.portal).not.toHaveBeenCalled()
    expect(m.refund).not.toHaveBeenCalled()
  })
  it.each([{ org_id: foreign }, { venture_id: 'foreign-venture' }])(
    'rejects reserved metadata conflicts before provider/storage',
    async (metadata) => {
      const { POST } = await import('../../app/api/stripe/subscriptions/route')
      expect(
        (await POST(request({ orgId: org, customerId: 'customer', priceId: 'price', metadata })))
          .status,
      ).toBe(400)
      expect(m.subscription).not.toHaveBeenCalled()
      expect(m.writes).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
    },
  )
  it('retains supported subscription creation and canonical actor audit', async () => {
    const { POST } = await import('../../app/api/stripe/subscriptions/route')
    expect(
      (
        await POST(
          request({
            orgId: org,
            customerId: 'customer',
            priceId: 'price',
            metadata: { custom: 'supported' },
          }),
        )
      ).status,
    ).toBe(201)
    expect(m.subscription).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: org, metadata: { custom: 'supported' } }),
    )
    expect(m.writes[0].value).toMatchObject({
      orgId: org,
      stripeSubscriptionId: 'sub_fixture',
      createdBy: userId,
    })
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: org, actorClerkUserId: userId }),
    )
  })
  it('portal refuses unrelated customers and retains the actual org/customer SQL pair', async () => {
    const { POST } = await import('../../app/api/stripe/customer-portal/route')
    expect(
      (
        await POST(
          request({
            orgId: org,
            customerId: 'foreign-customer',
            returnUrl: 'https://console.test/return',
          }),
        )
      ).status,
    ).toBe(403)
    const q = m.queries.find((q) => q.table === 'stripe_subscriptions')!
    expect(dialect.sqlToQuery(q.filter!).params).toEqual([org, 'foreign-customer'])
    expect(m.portal).not.toHaveBeenCalled()
  })
  it('retains actual refund threshold and pending approval before any execution provider', async () => {
    const { POST } = await import('../../app/api/stripe/refunds/route')
    m.rows.stripe_payments = [[{ id: paymentId, orgId: org, stripeObjectId: 'payment-intent' }]]
    expect((await POST(request({ orgId: org, paymentId, amountCents: 50000 }))).status).toBe(202)
    expect(m.refund).not.toHaveBeenCalled()
    expect(m.writes[0].value).toMatchObject({
      orgId: org,
      status: 'pending_approval',
      amountCents: 50000n,
      requestedBy: userId,
    })
  })
  it('refund approval refuses a foreign actual payment behind an owned refund before money/audit side effects', async () => {
    const { POST } = await import('../../app/api/stripe/refunds/approve/route')
    m.rows.stripe_refunds = [
      [{ id: refundId, orgId: org, paymentId, status: 'pending_approval', amountCents: 100n }],
    ]
    m.rows.stripe_payments = [
      [{ id: paymentId, orgId: foreign, stripeObjectId: 'foreign-payment-intent' }],
    ]
    expect((await POST(request({ orgId: org, refundId, action: 'approve' }))).status).toBe(403)
    expect(m.refund).not.toHaveBeenCalled()
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
  })
})

async function signedRequest(payload: string, mutate = false) {
  const { getStripeClient } = await import('@nzila/payments-stripe')
  const signature = getStripeClient().webhooks.generateTestHeaderString({
    payload,
    secret: 'whsec_fixture',
  })
  return new NextRequest('https://console.test/api', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: mutate ? payload + ' ' : payload,
  })
}
const webhook = () =>
  JSON.stringify({
    id: 'evt_owned_fixture',
    object: 'event',
    type: 'customer.subscription.deleted',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: { id: 'sub_owned_fixture', metadata: { org_id: org, custom: 'É\n"🧭"' } } },
  })
describe('actual Stripe SDK raw-body verification remains before moved storage work', () => {
  it.each([
    {
      name: 'subscription webhook',
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/stripe/webhooks/route')).POST(r),
    },
    {
      name: 'event normalization webhook',
      invoke: async (r: NextRequest) =>
        (await import('../../app/api/webhooks/stripe/route')).POST(r),
    },
  ])(
    '$name rejects a changed raw payload before SQL and accepts the genuine local signature',
    async (route) => {
      expect((await route.invoke(await signedRequest(webhook(), true))).status).toBe(400)
      expect(m.queries).toEqual([])
      expect(m.writes).toEqual([])
      expect((await route.invoke(await signedRequest(webhook()))).status).toBe(200)
      expect(m.writes.length).toBeGreaterThan(0)
    },
  )
  it('retains duplicate ledger response after signature verification without renormalization', async () => {
    const { POST } = await import('../../app/api/webhooks/stripe/route')
    m.rows.stripe_webhook_events = [[{ id: 'prior-event' }]]
    const response = await POST(await signedRequest(webhook()))
    expect(await response.json()).toEqual({ received: true, duplicate: true })
    expect(m.normalize).not.toHaveBeenCalled()
    expect(m.writes).toEqual([])
  })
  it('retains persisted failed-normalization behavior and records its actual failure marker', async () => {
    const { POST } = await import('../../app/api/webhooks/stripe/route')
    m.normalize.mockRejectedValueOnce(new Error('owned normalization outage'))
    expect((await POST(await signedRequest(webhook()))).status).toBe(200)
    expect(m.markFailed).toHaveBeenCalledExactlyOnceWith(
      'created-row',
      'owned normalization outage',
    )
    expect(m.writes[0].value).toMatchObject({
      stripeEventId: 'evt_owned_fixture',
      orgId: org,
      signatureValid: true,
    })
  })
})
