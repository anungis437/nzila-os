import { describe, it, expect } from 'vitest'
import {
  buildRuntimeHealthResponse,
  runtimeStatusFromChecks,
  type RuntimeHealthCheck,
} from '../health'

describe('runtimeStatusFromChecks', () => {
  it('returns not_instrumented when no checks supplied', () => {
    expect(runtimeStatusFromChecks({})).toBe('not_instrumented')
  })

  it('returns healthy when every check is ok', () => {
    const checks: Record<string, RuntimeHealthCheck> = {
      database: { status: 'ok', critical: true },
      github: { status: 'ok' },
    }
    expect(runtimeStatusFromChecks(checks)).toBe('healthy')
  })

  it('returns degraded when only non-critical check is degraded', () => {
    const checks: Record<string, RuntimeHealthCheck> = {
      database: { status: 'ok', critical: true },
      github: { status: 'degraded' },
    }
    expect(runtimeStatusFromChecks(checks)).toBe('degraded')
  })

  it('returns failing when a critical check is not ok', () => {
    const checks: Record<string, RuntimeHealthCheck> = {
      database: { status: 'fail', critical: true },
      github: { status: 'ok' },
    }
    expect(runtimeStatusFromChecks(checks)).toBe('failing')
  })

  it('returns failing when any non-critical check has hard fail', () => {
    const checks: Record<string, RuntimeHealthCheck> = {
      database: { status: 'ok', critical: true },
      cache: { status: 'fail' },
    }
    expect(runtimeStatusFromChecks(checks)).toBe('failing')
  })

  it('treats unknown as degraded (not failing)', () => {
    const checks: Record<string, RuntimeHealthCheck> = {
      database: { status: 'ok', critical: true },
      queue: { status: 'unknown' },
    }
    expect(runtimeStatusFromChecks(checks)).toBe('degraded')
  })
})

describe('buildRuntimeHealthResponse', () => {
  const baseInput = {
    app: 'orchestrator-api',
    timestamp: '2026-05-12T00:00:00.000Z',
    environment: 'test',
    version: '1.2.3',
  }

  it('marks ok=true for healthy', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: { database: { status: 'ok', critical: true } },
    })
    expect(res.status).toBe('healthy')
    expect(res.ok).toBe(true)
    expect(res.app).toBe('orchestrator-api')
    expect(res.environment).toBe('test')
    expect(res.version).toBe('1.2.3')
    expect(res.timestamp).toBe('2026-05-12T00:00:00.000Z')
  })

  it('marks ok=true for degraded (operationally informative, not an outage)', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: {
        database: { status: 'ok', critical: true },
        github: { status: 'degraded', note: 'token missing' },
      },
    })
    expect(res.status).toBe('degraded')
    expect(res.ok).toBe(true)
  })

  it('marks ok=false for failing (HTTP 503 mapping)', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: {
        database: {
          status: 'fail',
          critical: true,
          error: 'connection refused',
        },
      },
    })
    expect(res.status).toBe('failing')
    expect(res.ok).toBe(false)
  })

  it('honours notInstrumented override and emits reason', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: { database: { status: 'ok', critical: true } },
      notInstrumented: true,
      reason: 'app stub — no real probes yet',
    })
    expect(res.status).toBe('not_instrumented')
    expect(res.ok).toBe(true)
    expect(res.reason).toBe('app stub — no real probes yet')
  })

  it('passes through custom domain / fallback runtime status when provided', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: { database: { status: 'ok', critical: true } },
      customDomainStatus: 'failing',
      fallbackRuntimeStatus: 'healthy',
    })
    expect(res.customDomainStatus).toBe('failing')
    expect(res.fallbackRuntimeStatus).toBe('healthy')
  })

  it('omits optional fields when not provided', () => {
    const res = buildRuntimeHealthResponse({
      ...baseInput,
      checks: { database: { status: 'ok', critical: true } },
    })
    expect(res).not.toHaveProperty('customDomainStatus')
    expect(res).not.toHaveProperty('fallbackRuntimeStatus')
    expect(res).not.toHaveProperty('reason')
  })
})
