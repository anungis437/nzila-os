import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  isPlatformAdminUser: vi.fn(),
  queueStats: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  systemContexts: 0,
  selects: 0,
}))
vi.mock('@/lib/api-auth-guard', () => ({
  requireApiAuth: m.requireApiAuth,
  isPlatformAdminUser: m.isPlatformAdminUser,
}))
vi.mock('@/lib/job-queue', () => ({ getAllQueueStats: m.queueStats }))
vi.mock('@/lib/logger', () => ({ logger: { info: m.logInfo, error: m.logError, warn: vi.fn() } }))
// These are intentional forbidden DB handles; fail if any metrics code reads tenant tables.
vi.mock('@/db/db', () => ({
  db: new Proxy({}, { get: () => { throw new Error('forbidden database access') } }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: () => { m.systemContexts++; throw new Error('forbidden system context') },
}))

const METRICS_KEY = 'dedicated-metrics-key-of-at-least-32-characters'
const AI_KEY = 'not-the-metrics-key-ai-secret-of-32-chars'
const QUEUE_KEY = 'separate-queue-status-secret-of-32-chars'
const request = (key?: string) =>
  new Request('http://localhost/api/metrics/operational', {
    headers: key === undefined ? {} : { 'x-service-key': key },
  })

describe('operational metrics: dedicated scoped identity, no tenant content', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.systemContexts = 0
    m.selects = 0
    process.env.UE_METRICS_SERVICE_KEY = METRICS_KEY
    process.env.AI_SERVICE_KEY = AI_KEY
    process.env.QUEUE_STATUS_SERVICE_KEY = QUEUE_KEY
    m.queueStats.mockResolvedValue([{ active: 1, reserved: 2, scheduled: 3 }])
  })
  afterEach(() => {
    delete process.env.UE_METRICS_SERVICE_KEY
    delete process.env.AI_SERVICE_KEY
    delete process.env.QUEUE_STATUS_SERVICE_KEY
  })

  it('rejects anonymous, short, wrong, AI and queue keys before reading queue or DB', async () => {
    const { GET } = await import('../metrics/operational/route')
    for (const key of [undefined, '', 'wrong', METRICS_KEY.slice(0, -1), METRICS_KEY + 'x', AI_KEY, QUEUE_KEY]) {
      expect((await GET(request(key))).status, key ?? 'anonymous').toBe(401)
    }
    expect(m.queueStats).not.toHaveBeenCalled()
    expect(m.systemContexts).toBe(0)
  })

  it('rejects platform administrator sessions without the dedicated capability', async () => {
    const { GET } = await import('../metrics/operational/route')
    m.requireApiAuth.mockResolvedValue({ userId: 'platform-admin' })
    m.isPlatformAdminUser.mockResolvedValue(true)
    expect((await GET(request())).status).toBe(401)
    expect(m.requireApiAuth).not.toHaveBeenCalled()
    expect(m.isPlatformAdminUser).not.toHaveBeenCalled()
    expect(m.queueStats).not.toHaveBeenCalled()
  })

  it('fails closed on missing, weak or reused service configuration, answering 401 so the configuration is not disclosed', async () => {
    const { GET } = await import('../metrics/operational/route')
    delete process.env.UE_METRICS_SERVICE_KEY
    // An anonymous caller cannot tell an unconfigured server from a wrong key: both are 401.
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request(METRICS_KEY))).status).toBe(401)
    process.env.UE_METRICS_SERVICE_KEY = 'too-short'
    expect((await GET(request('too-short'))).status).toBe(401)
    process.env.UE_METRICS_SERVICE_KEY = AI_KEY
    expect((await GET(request(AI_KEY))).status).toBe(401)
    process.env.UE_METRICS_SERVICE_KEY = QUEUE_KEY
    expect((await GET(request(QUEUE_KEY))).status).toBe(401)
    expect(m.queueStats).not.toHaveBeenCalled()
    // The unsafe configuration is reported to operators server-side, once per refused request.
    expect(m.logError).toHaveBeenCalledWith('operational_metrics_service_key_unconfigured', expect.objectContaining({ capability: 'metrics:platform_operational:read' }))
    expect(m.logError).toHaveBeenCalledTimes(5)
  })

  it('authenticates a distinct metrics key and returns only queue infrastructure, without tenant reads', async () => {
    const { GET } = await import('../metrics/operational/route')
    const response = await GET(request(METRICS_KEY))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      scope: 'platform', queue_depth: 6, sla_violations: null,
      workflow_transition_rate: null, failure_like_updates: null,
      request_count: null, error_rate: null,
    })
    expect(m.logInfo).toHaveBeenCalledWith('operational_metrics_service_authorized', {
      principal: 'control-plane-operational-metrics', capability: 'metrics:platform_operational:read',
    })
    expect(m.systemContexts).toBe(0)
    expect(m.selects).toBe(0)
  })

  it('does not fabricate zero when the queue provider fails', async () => {
    const { GET } = await import('../metrics/operational/route')
    m.queueStats.mockRejectedValueOnce(new Error('queue outage with internal details'))
    const response = await GET(request(METRICS_KEY))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('internal details')
  })

  it('keeps a genuine empty queue at zero and never computes claim-derived rates', async () => {
    const { GET } = await import('../metrics/operational/route')
    m.queueStats.mockResolvedValueOnce([])
    const body = await (await GET(request(METRICS_KEY))).json()
    expect(body.queue_depth).toBe(0)
    expect(body.sla_violations).toBeNull()
    expect(m.systemContexts).toBe(0)
  })
})
