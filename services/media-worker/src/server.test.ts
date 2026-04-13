import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerMock: vi.fn(),
  incrementMock: vi.fn(),
  createHealthCheckerMock: vi.fn(),
  requestHandler: undefined as ((req: { url?: string; method?: string }, res: any) => Promise<void> | void) | undefined,
  serverMock: {
    listen: vi.fn((_: number, cb?: () => void) => cb?.()),
    close: vi.fn(),
  },
}))

vi.mock('node:http', () => ({
  createServer: mocks.createServerMock,
}))

vi.mock('./observability', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    createHealthChecker: mocks.createHealthCheckerMock,
    createMetricsCollector: vi.fn(() => ({
      increment: mocks.incrementMock,
      gauge: vi.fn(),
      histogram: vi.fn(),
      timing: vi.fn(),
    })),
  }
})

import { createHttpServer, registerShutdownHandlers, validateEnv, type ServerEnv } from './server'

function makeEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    S3_ENDPOINT: 'https://s3.example.com',
    S3_ACCESS_KEY_ID: 'access',
    S3_SECRET_ACCESS_KEY: 'secret',
    S3_BUCKET: 'bucket',
    S3_REGION: 'auto',
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    PORT: 18080,
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
    WORKER_CONCURRENCY: 2,
    POLL_INTERVAL_MS: 1000,
    SHUTDOWN_TIMEOUT_MS: 30000,
    ...overrides,
  }
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    writeHead: vi.fn(function writeHead(this: any, code: number, headers: Record<string, string>) {
      this.statusCode = code
      this.headers = headers
      return this
    }),
    end: vi.fn(function end(this: any, body: string) {
      this.body = body
      return this
    }),
  }
}

describe('validateEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  it('parses and defaults optional env values', () => {
    process.env = {
      S3_ENDPOINT: 'https://s3.example.com',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_BUCKET: 'bucket',
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '8081',
      LOG_LEVEL: 'debug',
      NODE_ENV: 'test',
      WORKER_CONCURRENCY: '3',
      POLL_INTERVAL_MS: '1200',
      SHUTDOWN_TIMEOUT_MS: '9000',
    }

    const env = validateEnv()
    expect(env.PORT).toBe(8081)
    expect(env.S3_REGION).toBe('auto')
  })

  it('throws with readable validation errors', () => {
    process.env = {
      S3_ENDPOINT: 'notaurl',
      S3_ACCESS_KEY_ID: '',
    }

    expect(() => validateEnv()).toThrow('Invalid environment configuration:')
  })
})

describe('createHttpServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestHandler = undefined
    mocks.createServerMock.mockImplementation((handler: typeof mocks.requestHandler) => {
      mocks.requestHandler = handler
      return mocks.serverMock
    })
  })

  it('serves /health with 200 for healthy status and records metric', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockResolvedValue({ status: 'healthy', checks: [] }),
    })

    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }
    const app = createHttpServer({
      env: makeEnv(),
      logger,
      healthChecks: [],
      onShutdown: vi.fn().mockResolvedValue(undefined),
    })

    await app.start()
    expect(mocks.serverMock.listen).toHaveBeenCalledWith(18080, expect.any(Function))

    const res = makeRes()
    await mocks.requestHandler?.({ url: '/health', method: 'GET' }, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.incrementMock).toHaveBeenCalledWith('http.health.requests', 1, { status: '200' })
  })

  it('serves /health with 503 for unhealthy status', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockResolvedValue({ status: 'unhealthy', checks: [] }),
    })

    createHttpServer({
      env: makeEnv(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
      healthChecks: [],
      onShutdown: vi.fn().mockResolvedValue(undefined),
    })

    const res = makeRes()
    await mocks.requestHandler?.({ url: '/health', method: 'GET' }, res)

    expect(res.statusCode).toBe(503)
  })

  it('serves /health with 500 when checker throws', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockRejectedValue(new Error('boom')),
    })

    createHttpServer({
      env: makeEnv(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
      healthChecks: [],
      onShutdown: vi.fn().mockResolvedValue(undefined),
    })

    const res = makeRes()
    await mocks.requestHandler?.({ url: '/health', method: 'GET' }, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toContain('health check error')
  })

  it('serves /ready and 404 for unknown route', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockResolvedValue({ status: 'healthy', checks: [] }),
    })

    createHttpServer({
      env: makeEnv(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
      healthChecks: [],
      onShutdown: vi.fn().mockResolvedValue(undefined),
    })

    const readyRes = makeRes()
    await mocks.requestHandler?.({ url: '/ready', method: 'GET' }, readyRes)
    expect(readyRes.statusCode).toBe(200)

    const notFoundRes = makeRes()
    await mocks.requestHandler?.({ url: '/missing', method: 'POST' }, notFoundRes)
    expect(notFoundRes.statusCode).toBe(404)
  })

  it('stop runs onShutdown once and is idempotent', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockResolvedValue({ status: 'healthy', checks: [] }),
    })

    const onShutdown = vi.fn().mockResolvedValue(undefined)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }
    const app = createHttpServer({
      env: makeEnv(),
      logger,
      healthChecks: [],
      onShutdown,
    })

    await app.stop()
    await app.stop()

    expect(mocks.serverMock.close).toHaveBeenCalledTimes(1)
    expect(onShutdown).toHaveBeenCalledTimes(1)
  })

  it('logs shutdown errors and still completes stop', async () => {
    mocks.createHealthCheckerMock.mockReturnValue({
      check: vi.fn().mockResolvedValue({ status: 'healthy', checks: [] }),
    })

    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }
    const app = createHttpServer({
      env: makeEnv(),
      logger,
      healthChecks: [],
      onShutdown: vi.fn().mockRejectedValue(new Error('stop failed')),
    })

    await app.stop()
    expect(logger.error).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('Shutdown complete')
  })
})

describe('registerShutdownHandlers', () => {
  it('registers process handlers and handles signal once', async () => {
    const handlers = new Map<string, (...args: any[]) => void>()
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, cb: (...args: any[]) => void) => {
      handlers.set(event, cb)
      return process
    }) as any)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }
    const shutdown = vi.fn().mockResolvedValue(undefined)

    registerShutdownHandlers(shutdown, logger)

    handlers.get('SIGTERM')?.()
    await Promise.resolve()
    handlers.get('SIGTERM')?.()
    await Promise.resolve()

    expect(onSpy).toHaveBeenCalled()
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)

    onSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('logs unhandled rejection reason as error', () => {
    const handlers = new Map<string, (...args: any[]) => void>()
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, cb: (...args: any[]) => void) => {
      handlers.set(event, cb)
      return process
    }) as any)

    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }
    registerShutdownHandlers(vi.fn().mockResolvedValue(undefined), logger)

    handlers.get('unhandledRejection')?.('raw-string-reason')
    expect(logger.error).toHaveBeenCalled()

    onSpy.mockRestore()
  })
})
