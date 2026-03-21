import { describe, it, expect } from 'vitest'
import {
  createLogger,
  createCorrelationId,
  createHealthChecker,
  createMetricsCollector,
  MediaWorkerError,
  isRetryableError,
  MEDIA_METRICS,
  type HealthCheckDep,
} from './observability'

describe('createCorrelationId', () => {
  it('returns a UUID-type string', () => {
    const id = createCorrelationId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('returns unique IDs', () => {
    const a = createCorrelationId()
    const b = createCorrelationId()
    expect(a).not.toBe(b)
  })
})

describe('createLogger', () => {
  it('emits structured JSON log via console', () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)

    const logger = createLogger('test-service', undefined, 'info')
    logger.info('hello', { key: 'value' })

    console.log = origLog

    expect(logs).toHaveLength(1)
    const parsed = JSON.parse(logs[0]!)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('hello')
    expect(parsed.service).toBe('test-service')
    expect(parsed.context.key).toBe('value')
  })

  it('respects minimum log level', () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)

    const logger = createLogger('test', undefined, 'warn')
    logger.info('should be hidden')
    logger.debug('also hidden')

    console.log = origLog
    expect(logs).toHaveLength(0)
  })

  it('includes correlation context', () => {
    const logs: string[] = []
    const origLog = console.log
    console.log = (msg: string) => logs.push(msg)

    const logger = createLogger('test', {
      correlationId: 'corr-123',
      jobId: 'job-456',
    }, 'info')
    logger.info('test')

    console.log = origLog
    const parsed = JSON.parse(logs[0]!)
    expect(parsed.correlationId).toBe('corr-123')
    expect(parsed.context.jobId).toBe('job-456')
  })

  it('child creates logger with merged context', () => {
    const logger = createLogger('test', { correlationId: 'c1' }, 'info')
    const child = logger.child({ extra: 'data' })
    expect(child).toBeDefined()
  })

  it('error logs to console.error', () => {
    const errorLogs: string[] = []
    const origError = console.error
    console.error = (msg: string) => errorLogs.push(msg)

    const logger = createLogger('test', undefined, 'info')
    logger.error('fail', new Error('boom'))

    console.error = origError
    const parsed = JSON.parse(errorLogs[0]!)
    expect(parsed.level).toBe('error')
    expect(parsed.error.message).toBe('boom')
  })
})

describe('MediaWorkerError', () => {
  it('captures code and retryable flag', () => {
    const err = new MediaWorkerError('TRANSCODE_FAILED', 'ffmpeg crashed', {
      retryable: false,
      context: { assetId: 'a1' },
    })
    expect(err.code).toBe('TRANSCODE_FAILED')
    expect(err.retryable).toBe(false)
    expect(err.context.assetId).toBe('a1')
    expect(err.name).toBe('MediaWorkerError')
  })

  it('defaults to non-retryable', () => {
    const err = new MediaWorkerError('STORAGE_NOT_FOUND', 'not found')
    expect(err.retryable).toBe(false)
  })
})

describe('isRetryableError', () => {
  it('returns true for retryable MediaWorkerError', () => {
    const err = new MediaWorkerError('REDIS_CONNECTION_FAILED', 'conn lost', { retryable: true })
    expect(isRetryableError(err)).toBe(true)
  })

  it('returns false for non-retryable MediaWorkerError', () => {
    const err = new MediaWorkerError('INVALID_SOURCE_FORMAT', 'bad format')
    expect(isRetryableError(err)).toBe(false)
  })

  it('returns true for timeout errors', () => {
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true)
  })

  it('returns true for connection refused', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true)
  })

  it('returns false for unknown errors', () => {
    expect(isRetryableError(new Error('Something weird'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false)
  })
})

describe('createHealthChecker', () => {
  it('returns healthy when all checks pass', async () => {
    const checker = createHealthChecker({
      version: '1.0.0',
      startTime: Date.now(),
      checks: [
        { name: 'redis', check: async () => ({ ok: true }) },
        { name: 'storage', check: async () => ({ ok: true }) },
      ],
    })

    const status = await checker.check()
    expect(status.status).toBe('healthy')
    expect(status.checks).toHaveLength(2)
    expect(status.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  it('returns unhealthy when a check fails', async () => {
    const checker = createHealthChecker({
      version: '1.0.0',
      startTime: Date.now(),
      checks: [
        { name: 'redis', check: async () => ({ ok: false, message: 'down' }) },
      ],
    })

    const status = await checker.check()
    expect(status.status).toBe('unhealthy')
    expect(status.checks[0]!.status).toBe('fail')
    expect(status.checks[0]!.message).toBe('down')
  })

  it('handles check that throws', async () => {
    const checker = createHealthChecker({
      version: '1.0.0',
      startTime: Date.now(),
      checks: [
        { name: 'db', check: async () => { throw new Error('conn failed') } },
      ],
    })

    const status = await checker.check()
    expect(status.status).toBe('unhealthy')
    expect(status.checks[0]!.status).toBe('fail')
    expect(status.checks[0]!.message).toContain('conn failed')
  })

  it('reports uptime', async () => {
    const startTime = Date.now() - 5000
    const checker = createHealthChecker({
      version: '1.0.0',
      startTime,
      checks: [],
    })

    const status = await checker.check()
    expect(status.uptime).toBeGreaterThanOrEqual(4000)
    expect(status.version).toBe('1.0.0')
  })
})

describe('MEDIA_METRICS', () => {
  it('has expected metric names', () => {
    expect(MEDIA_METRICS.TRANSCODE_STARTED).toBe('media.transcode.started')
    expect(MEDIA_METRICS.QUEUE_DEPTH).toBe('media.queue.depth')
    expect(MEDIA_METRICS.STREAM_SERVED).toBe('media.stream.served')
    expect(MEDIA_METRICS.PREVIEW_GENERATED).toBe('media.preview.generated')
  })
})
