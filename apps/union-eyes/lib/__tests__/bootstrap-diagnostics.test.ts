import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ demo: vi.fn(), bypass: vi.fn(), otel: vi.fn(), logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../reality/demo-deployment-guard', () => ({ evaluateDemoGuard: mocks.demo }))
vi.mock('../reality/test-bypass-guard', () => ({ evaluateTestBypassGuard: mocks.bypass, readTestBypassGuardEnv: () => ({}) }))
vi.mock('@nzila/os-core/telemetry', () => ({ initOtel: mocks.otel, initMetrics: vi.fn(), createLogger: () => mocks.logger }))
vi.mock('@nzila/os-core/config', () => ({ validateEnv: vi.fn() }))
vi.mock('../logger', () => ({ logger: mocks.logger }))
vi.mock('../governance/runtime', () => ({ bindGovernanceRuntime: vi.fn() }))
vi.mock('../config/env-validation', () => ({ validateEnvironment: () => ({ isValid: true, warnings: [] }), printEnvironmentReport: vi.fn() }))
vi.mock('../config/pilot-demo-runtime', () => ({ getPilotDemoRuntimeValidation: () => ({ isKnownMode: true, allowsDemoMutations: false, startupMessage: 'fixture' }) }))
vi.mock('../runtime/fail-closed', () => ({ enforceRuntimeFailClosed: vi.fn(), RuntimeContractError: class extends Error {} }))
vi.mock('../runtime/startup-checks', () => ({ skipsDatabaseStartupCheck: () => true }))
vi.mock('../../sentry.server.config', () => ({}))
vi.mock('@sentry/nextjs', () => ({ init: vi.fn(), captureRouterTransitionStart: vi.fn(), replayIntegration: vi.fn() }))
import { register } from '../../instrumentation'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_RUNTIME', 'nodejs'); vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('NEXT_PHASE', '')
  vi.stubEnv('REDIS_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  mocks.demo.mockReturnValue({ ok: true }); mocks.bypass.mockReturnValue({ ok: true }); mocks.otel.mockResolvedValue(undefined)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

describe('bootstrap diagnostics preserve authority and primary operations', () => {
  it.each(['demo-refused', 'demo-thrown', 'bypass-refused', 'bypass-thrown'] as const)('still exits1 for %s without disclosing caught values', async failure => {
    if (failure === 'demo-refused') mocks.demo.mockReturnValue({ ok: false, reason: 'private-canary' })
    if (failure === 'demo-thrown') mocks.demo.mockImplementation(() => { throw new Error('private-canary') })
    if (failure === 'bypass-refused') mocks.bypass.mockReturnValue({ ok: false, reason: 'private-canary' })
    if (failure === 'bypass-thrown') mocks.bypass.mockImplementation(() => { throw new Error('private-canary') })
    const outputs: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation(value => { outputs.push(String(value)); return true })
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('owned-exit-sentinel') })
    await expect(register()).rejects.toThrow('owned-exit-sentinel')
    expect(exit).toHaveBeenCalledWith(1)
    expect(exit.mock.calls.every(([code]) => code === 1)).toBe(true)
    expect(outputs.join('')).not.toContain('private-canary')
    expect(outputs.every(value => Object.keys(JSON.parse(value)).sort().join(',') === 'app,code,level')).toBe(true)
  })
  it('preserves guard termination when stderr itself is unavailable', async () => {
    mocks.demo.mockReturnValue({ ok: false })
    vi.spyOn(process.stderr, 'write').mockImplementation(() => { throw new Error('sink-failed') })
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('owned-exit-sentinel') })
    await expect(register()).rejects.toThrow('owned-exit-sentinel')
    expect(exit).toHaveBeenCalledWith(1)
  })
  it('reports OTel initialization failure with a fixed code and continues noncritical startup', async () => {
    mocks.otel.mockRejectedValue(new Error('private-canary'))
    const outputs: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation(value => { outputs.push(String(value)); return true })
    const exit = vi.spyOn(process, 'exit')
    const methods = Object.getOwnPropertyDescriptors(console)
    await register()
    expect(outputs).toEqual(['{"app":"union-eyes","level":"error","code":"UE_OTEL_INITIALIZATION_FAILED"}\n'])
    expect(exit).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptors(console)).toEqual(methods)
  })
  it('does not replace global console methods during browser instrumentation', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const methods = Object.getOwnPropertyDescriptors(console)
    await import('../../instrumentation-client')
    expect(Object.getOwnPropertyDescriptors(console)).toEqual(methods)
  })
})
