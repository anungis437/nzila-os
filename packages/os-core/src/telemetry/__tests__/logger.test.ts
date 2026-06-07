import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must mock requestContext before importing logger
vi.mock('../requestContext', () => ({
  getRequestContext: vi.fn(() => undefined),
}))

import { createLogger, childLogger, logger, redactFields } from '../logger'
import { getRequestContext } from '../requestContext'

describe('logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(getRequestContext).mockReturnValue(undefined)
    delete process.env.LOG_LEVEL
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  describe('createLogger', () => {
    it('info writes JSON to stdout', () => {
      const log = createLogger()
      log.info('hello')
      expect(stdoutSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(stdoutSpy.mock.calls[0]![0] as string)
      expect(parsed.level).toBe('info')
      expect(parsed.message).toBe('hello')
      expect(parsed.timestamp).toBeDefined()
    })

    it('warn writes to stderr', () => {
      const log = createLogger()
      log.warn('caution')
      expect(stderrSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(stderrSpy.mock.calls[0]![0] as string)
      expect(parsed.level).toBe('warn')
    })

    it('error writes to stderr', () => {
      const log = createLogger()
      log.error('fail')
      expect(stderrSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(stderrSpy.mock.calls[0]![0] as string)
      expect(parsed.level).toBe('error')
    })

    it('debug is suppressed unless LOG_LEVEL=debug', () => {
      const log = createLogger()
      log.debug('detail')
      expect(stdoutSpy).not.toHaveBeenCalled()

      process.env.LOG_LEVEL = 'debug'
      log.debug('detail')
      expect(stdoutSpy).toHaveBeenCalledTimes(1)
    })

    it('includes namespace prefix when provided', () => {
      const log = createLogger('evidence')
      log.info('packed')
      const parsed = JSON.parse(stdoutSpy.mock.calls[0]![0] as string)
      expect(parsed.message).toBe('[evidence] packed')
    })

    it('includes extra metadata', () => {
      const log = createLogger()
      log.info('event', { packId: 'IR-1', count: 5 })
      const parsed = JSON.parse(stdoutSpy.mock.calls[0]![0] as string)
      expect(parsed.packId).toBe('IR-1')
      expect(parsed.count).toBe(5)
    })

    it('formats Error objects into error fields', () => {
      const log = createLogger()
      const err = new Error('boom')
      log.error('failed', err)
      const parsed = JSON.parse(stderrSpy.mock.calls[0]![0] as string)
      expect(parsed.errorName).toBe('Error')
      expect(parsed.errorMessage).toBe('boom')
      expect(parsed.errorStack).toBeDefined()
    })

    it('injects request context when present', () => {
      vi.mocked(getRequestContext).mockReturnValue({
        requestId: 'req-x',
        traceId: 'trace-y',
        userId: 'u1',
        orgId: 'o1',
        appName: 'console',
        startedAt: Date.now(),
      })
      const log = createLogger()
      log.info('ctx')
      const parsed = JSON.parse(stdoutSpy.mock.calls[0]![0] as string)
      expect(parsed.requestId).toBe('req-x')
      expect(parsed.traceId).toBe('trace-y')
      expect(parsed.userId).toBe('u1')
      expect(parsed.orgId).toBe('o1')
      expect(parsed.appName).toBe('console')
    })
  })

  describe('childLogger', () => {
    it('creates a logger with combined namespace', () => {
      const log = childLogger('evidence', 'seal')
      log.info('done')
      const parsed = JSON.parse(stdoutSpy.mock.calls[0]![0] as string)
      expect(parsed.message).toBe('[evidence:seal] done')
    })
  })

  describe('global logger', () => {
    it('is a Logger instance', () => {
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
    })
  })

  describe('redactFields', () => {
    it('redacts known sensitive keys', () => {
      const result = redactFields({ email: 'a@b.com', name: 'Alice' })
      expect(result.email).toBe('[REDACTED]')
      expect(result.name).toBe('Alice')
    })

    it('redacts nested objects', () => {
      const result = redactFields({ user: { email: 'a@b.com', id: '1' } })
      const user = result.user as { email?: string; id?: string }
      expect(user.email).toBe('[REDACTED]')
      expect(user.id).toBe('1')
    })

    it('redacts arrays of objects', () => {
      const result = redactFields({ items: [{ token: 'abc' }, { value: 99 }] })
      const items = result.items as Array<{ token?: string; value?: number }>
      expect(items[0]?.token).toBe('[REDACTED]')
      expect(items[1]?.value).toBe(99)
    })

    it('redacts Bearer tokens in string values', () => {
      const result = redactFields({ header: 'Bearer eyJhbGciOiJIUzI1NiJ9' })
      expect(result.header).toBe('[REDACTED]')
    })

    it('does not mutate the original object', () => {
      const original = { email: 'a@b.com', x: 1 }
      redactFields(original)
      expect(original.email).toBe('a@b.com')
    })

    it('redacts case-insensitive keys (password, Password, PASSWORD)', () => {
      const result = redactFields({ password: 'secret', apiKey: 'key123' })
      expect(result.password).toBe('[REDACTED]')
      expect(result.apiKey).toBe('[REDACTED]')
    })

    it('redacts database_url and connection_string', () => {
      const result = redactFields({
        database_url: 'postgres://...',
        connection_string: 'Server=...',
      })
      expect(result.database_url).toBe('[REDACTED]')
      expect(result.connection_string).toBe('[REDACTED]')
    })
  })
})
