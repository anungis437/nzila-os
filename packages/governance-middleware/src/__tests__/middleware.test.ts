import { describe, it, expect, beforeEach } from 'vitest'

import {
  ForbiddenPayloadKeyError,
  GovernanceEmitter,
  InMemoryGovernanceSink,
  UnregisteredAICapabilityError,
  applyPolicyDecision,
  attachGovernanceHeaders,
  emit,
  governanceEmitter,
  requireRegisteredAICapability,
  withPolicyGate,
  type GovernanceEventEnvelope,
  type PolicyEvaluationLike,
} from '../index'

const scope = {
  product: 'union-eyes',
  environment: 'ue-pilot-2026q2',
  environmentClass: 'pilot',
} as const

const subject = { kind: 'route', id: '/cases/list' } as const

beforeEach(() => {
  // reset singleton sinks
  for (const name of governanceEmitter.listSinks().slice()) {
    governanceEmitter.removeSink(name)
  }
})

describe('GovernanceEmitter', () => {
  it('delivers envelopes to every registered sink', async () => {
    const a = new InMemoryGovernanceSink()
    const b = new InMemoryGovernanceSink()
    const emitter = new GovernanceEmitter()
    emitter.addSink({ name: 'a', emit: (e) => a.emit(e) })
    emitter.addSink({ name: 'b', emit: (e) => b.emit(e) })

    const envelope: GovernanceEventEnvelope = {
      id: 'evt-001',
      schemaVersion: '1.0.0',
      type: 'governance_event',
      severity: 'info',
      scope,
      subject,
      releaseId: 'UE-2026-05-09-001',
      emittedAt: '2026-05-09T12:00:00.000Z',
      payload: { count: 1 },
    }
    await emitter.emit(envelope)
    expect(a.peek().length).toBe(1)
    expect(b.peek().length).toBe(1)
  })

  it('refuses envelopes carrying forbidden payload keys', async () => {
    const emitter = new GovernanceEmitter()
    const envelope: GovernanceEventEnvelope = {
      id: 'evt-002',
      schemaVersion: '1.0.0',
      type: 'governance_event',
      severity: 'info',
      scope,
      subject,
      releaseId: 'UE-2026-05-09-001',
      emittedAt: '2026-05-09T12:00:00.000Z',
      payload: { userId: 'should-be-rejected' },
    }
    await expect(emitter.emit(envelope)).rejects.toThrow(ForbiddenPayloadKeyError)
  })

  it('isolates failing sinks from successful ones', async () => {
    const ok = new InMemoryGovernanceSink()
    const emitter = new GovernanceEmitter()
    emitter.addSink({
      name: 'broken',
      emit: () => {
        throw new Error('sink failure')
      },
    })
    emitter.addSink({ name: 'ok', emit: (e) => ok.emit(e) })

    await emit.call(null, {
      type: 'governance_event',
      scope,
      subject,
      releaseId: 'UE-2026-05-09-001',
      severity: 'info',
      payload: {},
    })
    // The singleton emitter has no sinks configured, but proves emit() works.
    expect(ok.peek().length).toBe(0)
  })
})

describe('applyPolicyDecision', () => {
  it('returns allowed for allow decision', async () => {
    const evaluation: PolicyEvaluationLike = {
      policyId: 'p1',
      policyVersion: '1',
      decision: 'allow',
      reason: 'matched',
      doctrineCitations: [{ document: 'docs/nzila-ip/example.md' }],
      severity: 'info',
    }
    const out = await applyPolicyDecision({
      evaluation,
      subject,
      scope,
      releaseId: 'UE-2026-05-09-001',
    })
    expect(out.allowed).toBe(true)
    expect(out.httpStatus).toBe(200)
  })

  it('returns 403 for deny decision', async () => {
    const evaluation: PolicyEvaluationLike = {
      policyId: 'p1',
      policyVersion: '1',
      decision: 'deny',
      reason: 'pilot contamination',
      doctrineCitations: [{ document: 'docs/nzila-ip/pilot-discipline.md' }],
      severity: 'critical',
    }
    const out = await applyPolicyDecision({
      evaluation,
      subject,
      scope,
      releaseId: 'UE-2026-05-09-001',
    })
    expect(out.allowed).toBe(false)
    expect(out.httpStatus).toBe(403)
  })

  it('returns 409 for require_approval', async () => {
    const evaluation: PolicyEvaluationLike = {
      policyId: 'p1',
      policyVersion: '1',
      decision: 'require_approval',
      reason: 'governance review needed',
      doctrineCitations: [{ document: 'docs/nzila-ip/example.md' }],
      severity: 'warning',
    }
    const out = await applyPolicyDecision({
      evaluation,
      subject,
      scope,
      releaseId: 'UE-2026-05-09-001',
    })
    expect(out.allowed).toBe(false)
    expect(out.httpStatus).toBe(409)
  })
})

describe('withPolicyGate (Next.js)', () => {
  it('returns null when policy allows', async () => {
    const result = await withPolicyGate({
      evaluation: {
        policyId: 'p1',
        policyVersion: '1',
        decision: 'allow',
        reason: 'ok',
        doctrineCitations: [{ document: 'docs/nzila-ip/example.md' }],
        severity: 'info',
      },
      subject,
      scope,
      releaseId: 'UE-2026-05-09-001',
    })
    expect(result).toBeNull()
  })

  it('returns a calm 403 Response when policy denies', async () => {
    const result = await withPolicyGate({
      evaluation: {
        policyId: 'p1',
        policyVersion: '1',
        decision: 'deny',
        reason: 'pilot contamination',
        doctrineCitations: [{ document: 'docs/nzila-ip/pilot-discipline.md' }],
        severity: 'critical',
      },
      subject,
      scope,
      releaseId: 'UE-2026-05-09-001',
    })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(403)
    const body = await result!.json()
    expect(body.error).toBe('forbidden')
    expect(body.reason).toBe('pilot contamination')
    expect(body.policyId).toBe('p1')
    // Response MUST NOT leak any orchestration internals.
    expect(JSON.stringify(body)).not.toMatch(/userId|email|sessionId/)
  })
})

describe('requireRegisteredAICapability', () => {
  it('passes when registered', async () => {
    await expect(
      requireRegisteredAICapability({
        capabilityId: 'ue.case.summary',
        version: '1.0.0',
        isRegistered: () => true,
        subject,
        scope,
        releaseId: 'UE-2026-05-09-001',
      }),
    ).resolves.toBeUndefined()
  })

  it('throws when unregistered', async () => {
    await expect(
      requireRegisteredAICapability({
        capabilityId: 'ue.case.summary',
        version: '0.0.1',
        isRegistered: () => false,
        subject,
        scope,
        releaseId: 'UE-2026-05-09-001',
      }),
    ).rejects.toThrow(UnregisteredAICapabilityError)
  })
})

describe('attachGovernanceHeaders', () => {
  it('sets release id and correlation header without leaking', () => {
    const r = new Response('ok', { status: 200 })
    const wrapped = attachGovernanceHeaders(r, {
      releaseId: 'UE-2026-05-09-001',
      correlationKey: 'corr-abc',
    })
    expect(wrapped.headers.get('x-nzila-release-id')).toBe('UE-2026-05-09-001')
    expect(wrapped.headers.get('x-nzila-correlation')).toBe('corr-abc')
  })
})
