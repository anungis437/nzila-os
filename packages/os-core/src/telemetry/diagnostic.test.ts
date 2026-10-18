import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeDiagnostic } from './diagnostic'
import { createLogger, type Logger } from './logger'
import { runWithContext } from './requestContext'

afterEach(() => vi.restoreAllMocks())

describe('best-effort structured diagnostics', () => {
  it('redacts metadata and overrides identity injected from request context', () => {
    const sink = vi.spyOn(console, 'log').mockImplementation(() => {})
    runWithContext({ requestId: 'request', startedAt: 0, orgId: 'private-org', userId: 'private-user' }, () => {
      writeDiagnostic(createLogger('test'), 'info', 'Fixed diagnostic', {
        email: 'private@example.invalid', nested: { token: 'private-token' }, count: 2,
      })
    })
    expect(JSON.parse(sink.mock.calls[0][0])).toMatchObject({
      orgId: '[REDACTED]', userId: '[REDACTED]', email: '[REDACTED]',
      nested: { token: '[REDACTED]' }, count: 2, requestId: 'request',
    })
  })
  it('reports logger failure to stderr without payloads or recursive logger calls', () => {
    const error = vi.fn(() => { throw new Error('private credential') })
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => writeDiagnostic({ error } as unknown as Logger, 'error', 'Fixed diagnostic')).not.toThrow()
    expect(error).toHaveBeenCalledTimes(1)
    expect(stderr).toHaveBeenCalledExactlyOnceWith('{"level":"error","message":"Structured diagnostic sink failed"}\n')
  })
  it('uses a fixed process warning when stderr is unavailable and never propagates sink failures', () => {
    const error = vi.fn(() => { throw new Error('private') })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => { throw new Error('closed') })
    const warning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    writeDiagnostic({ error } as unknown as Logger, 'error', 'Fixed diagnostic')
    expect(warning).toHaveBeenCalledExactlyOnceWith('Diagnostic output unavailable', { code: 'DIAGNOSTIC_SINK_FAILED' })
    warning.mockImplementation(() => { throw new Error('unavailable') })
    expect(() => writeDiagnostic({ error } as unknown as Logger, 'error', 'Fixed diagnostic')).not.toThrow()
  })
})
