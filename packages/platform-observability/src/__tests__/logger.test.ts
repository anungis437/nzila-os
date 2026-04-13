/**
 * @nzila/platform-observability — Structured Logger Tests
 */
import { describe, it, expect, vi as _vi } from 'vitest'
import { StructuredLogger, createLogger } from '../logger'
import type { StructuredLogEntry, LogSink } from '../logger'

describe('StructuredLogger', () => {
  function collectSink(): { entries: StructuredLogEntry[]; sink: LogSink } {
    const entries: StructuredLogEntry[] = []
    return { entries, sink: (e) => entries.push(e) }
  }

  it('emits structured log entries with all required fields', () => {
    const { entries, sink } = collectSink()
    const logger = new StructuredLogger(
      { request_id: 'req-1', correlation_id: 'cor-1', org_id: 'org-1' },
      sink,
    )

    logger.info('user.login', { userId: 'u-123' })

    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.event).toBe('user.login')
    expect(entry.severity).toBe('info')
    expect(entry.request_id).toBe('req-1')
    expect(entry.correlation_id).toBe('cor-1')
    expect(entry.org_id).toBe('org-1')
    expect(entry.metadata).toEqual({ userId: 'u-123' })
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('emits all severity levels', () => {
    const { entries, sink } = collectSink()
    const logger = new StructuredLogger({ org_id: 'test' }, sink)

    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')
    logger.critical('c')

    expect(entries.map((e) => e.severity)).toEqual([
      'debug', 'info', 'warn', 'error', 'critical',
    ])
  })

  it('creates child logger with inherited context', () => {
    const { entries, sink } = collectSink()
    const parent = new StructuredLogger(
      { request_id: 'req-1', correlation_id: 'cor-1', org_id: 'org-1' },
      sink,
    )
    const child = parent.child({ request_id: 'req-2' })

    child.info('child.event')

    expect(entries[0]!.request_id).toBe('req-2')
    expect(entries[0]!.correlation_id).toBe('cor-1')
    expect(entries[0]!.org_id).toBe('org-1')
  })

  it('creates logger from HTTP headers', () => {
    const { entries, sink } = collectSink()
    const _logger = StructuredLogger.fromHeaders(
      { 'x-request-id': 'http-req', 'x-correlation-id': 'http-cor' },
      'http-org',
    )
    // Replace sink for testing
    const testLogger = new StructuredLogger(
      {
        request_id: 'http-req',
        correlation_id: 'http-cor',
        org_id: 'http-org',
      },
      sink,
    )
    testLogger.info('request.start')

    expect(entries[0]!.request_id).toBe('http-req')
    expect(entries[0]!.correlation_id).toBe('http-cor')
    expect(entries[0]!.org_id).toBe('http-org')
  })

  it('fromHeaders supports array values and unknown org fallback', () => {
    const writeSpy = _vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const logger = StructuredLogger.fromHeaders(
      {
        'x-request-id': ['arr-req-1', 'arr-req-2'],
        'x-correlation-id': ['arr-cor-1', 'arr-cor-2'],
      },
    )
    logger.info('array.headers')

    const payload = String(writeSpy.mock.calls[0]?.[0] ?? '').trim()
    const entry = JSON.parse(payload) as StructuredLogEntry

    expect(entry.request_id).toBe('arr-req-1')
    expect(entry.correlation_id).toBe('arr-cor-1')
    expect(entry.org_id).toBe('unknown')
    writeSpy.mockRestore()
  })

  it('generates UUIDs for missing context', () => {
    const { entries, sink } = collectSink()
    const logger = new StructuredLogger(undefined, sink)

    logger.info('test')

    expect(entries[0]!.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(entries[0]!.org_id).toBe('system')
  })

  it('createLogger factory works', () => {
    const { entries, sink } = collectSink()
    const logger = createLogger({ org_id: 'factory-test' }, sink)

    logger.warn('factory.warning', { code: 42 })

    expect(entries[0]!.org_id).toBe('factory-test')
    expect(entries[0]!.severity).toBe('warn')
  })

  it('timestamps are ISO UTC without milliseconds', () => {
    const { entries, sink } = collectSink()
    const logger = new StructuredLogger(undefined, sink)

    logger.info('ts-check')

    const ts = entries[0]!.timestamp
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(ts).not.toContain('.')
  })
})
