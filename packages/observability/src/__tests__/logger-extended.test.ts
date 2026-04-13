/**
 * @nzila/observability — Extended logger tests
 *
 * Covers defaultSink (stdout/stderr), createLogger factory, level filtering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TracedLogger, createLogger, type LogEntry } from '../logger'

describe('TracedLogger — level filtering', () => {
  it('suppresses debug when minLevel is info', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'test', minLevel: 'info', sink })

    logger.debug('should be suppressed')
    expect(sink).not.toHaveBeenCalled()

    logger.info('should pass')
    expect(sink).toHaveBeenCalledOnce()
  })

  it('suppresses debug and info when minLevel is warn', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'test', minLevel: 'warn', sink })

    logger.debug('nope')
    logger.info('nope')
    expect(sink).not.toHaveBeenCalled()

    logger.warn('yes')
    expect(sink).toHaveBeenCalledOnce()
  })

  it('only passes error when minLevel is error', () => {
    const sink = vi.fn()
    const logger = new TracedLogger({ service: 'test', minLevel: 'error', sink })

    logger.debug('nope')
    logger.info('nope')
    logger.warn('nope')
    expect(sink).not.toHaveBeenCalled()

    logger.error('yes')
    expect(sink).toHaveBeenCalledOnce()
  })
})

describe('TracedLogger — defaultSink', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('writes info-level entries to stdout', () => {
    const logger = new TracedLogger({ service: 'svc' }) // uses defaultSink
    logger.info('hello')

    expect(stdoutSpy).toHaveBeenCalledOnce()
    const written = stdoutSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(written.trim()) as LogEntry
    expect(parsed.level).toBe('info')
    expect(parsed.event).toBe('hello')
    expect(parsed.metadata.service).toBe('svc')
  })

  it('writes error-level entries to stderr', () => {
    const logger = new TracedLogger({ service: 'svc' })
    logger.error('boom')

    expect(stderrSpy).toHaveBeenCalledOnce()
    const written = stderrSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(written.trim()) as LogEntry
    expect(parsed.level).toBe('error')
    expect(parsed.event).toBe('boom')
  })

  it('writes warn to stdout not stderr', () => {
    const logger = new TracedLogger({ service: 'svc' })
    logger.warn('careful')

    expect(stdoutSpy).toHaveBeenCalledOnce()
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})

describe('createLogger factory', () => {
  it('returns a TracedLogger instance', () => {
    const logger = createLogger('my-service')
    expect(logger).toBeInstanceOf(TracedLogger)
  })

  it('accepts optional overrides', () => {
    const sink = vi.fn()
    const logger = createLogger('my-service', { minLevel: 'warn', sink })

    logger.info('skip')
    expect(sink).not.toHaveBeenCalled()

    logger.warn('allow')
    expect(sink).toHaveBeenCalledOnce()
  })
})

describe('TracedLogger — child merges metadata', () => {
  it('child prepends extra metadata to every log', () => {
    const sink = vi.fn()
    const parent = new TracedLogger({ service: 'svc', sink })
    const child = parent.child({ module: 'auth' })

    child.info('event', { detail: 42 })
    expect(sink).toHaveBeenCalledOnce()
    const entry: LogEntry = sink.mock.calls[0][0]
    expect(entry.metadata.module).toBe('auth')
    expect(entry.metadata.detail).toBe(42)
    expect(entry.metadata.service).toBe('svc')
  })

  it('call-site metadata overrides child extra', () => {
    const sink = vi.fn()
    const parent = new TracedLogger({ service: 'svc', sink })
    const child = parent.child({ x: 1, y: 2 })

    child.info('event', { y: 99 })
    const entry: LogEntry = sink.mock.calls[0][0]
    expect(entry.metadata.x).toBe(1)
    expect(entry.metadata.y).toBe(99) // overridden
  })
})
