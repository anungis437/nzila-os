import { describe, it, expect, beforeEach } from 'vitest'
import { trace } from '@opentelemetry/api'

import {
  FORBIDDEN_OTEL_ATTRIBUTE_KEYS,
  emitGovernanceSpan,
  withGovernanceSpan,
  type GovernanceEventEnvelopeLike,
} from '../index'

interface CapturedSpan {
  readonly name: string
  readonly attributes: Record<string, unknown>
  ended: boolean
}

let captured: CapturedSpan[] = []

function makeStubSpan(name: string): CapturedSpan & {
  setAttribute(key: string, value: unknown): CapturedSpan
  setStatus(): CapturedSpan
  recordException(): void
  end(): void
} {
  const span: CapturedSpan = { name, attributes: {}, ended: false }
  captured.push(span)
  return Object.assign(span, {
    setAttribute(key: string, value: unknown) {
      span.attributes[key] = value
      return span
    },
    setStatus() {
      return span
    },
    recordException() {},
    end() {
      span.ended = true
    },
  }) as never
}

beforeEach(() => {
  captured = []
  const stubTracer = {
    startSpan: (name: string) => makeStubSpan(name),
    startActiveSpan: ((name: string, fnOrOptions: unknown, fn?: unknown) => {
      const span = makeStubSpan(name)
      const callback = typeof fnOrOptions === 'function' ? fnOrOptions : fn
      return (callback as (s: unknown) => unknown)(span)
    }) as never,
  }
  trace.setGlobalTracerProvider({
    getTracer: () => stubTracer as never,
  } as never)
})

const envelope: GovernanceEventEnvelopeLike = {
  id: 'evt-001',
  schemaVersion: '1.0.0',
  type: 'doctrine_enforcement_event',
  severity: 'warning',
  scope: {
    product: 'union-eyes',
    environment: 'ue-pilot-2026q2',
    environmentClass: 'pilot',
  },
  subject: { kind: 'route', id: '/cases/list' },
  doctrineCitations: [{ document: 'docs/nzila-ip/pilot-discipline.md' }],
  decision: 'deny',
  releaseId: 'UE-2026-05-09-001',
  emittedAt: '2026-05-09T12:00:00.000Z',
  payload: { count: 7, label: 'pilot-isolation', userId: 'should-be-dropped' },
}

describe('emitGovernanceSpan', () => {
  it('opens a span with governance semantic attributes', () => {
    const name = emitGovernanceSpan(envelope)
    expect(name).toBe('governance.doctrine_enforcement_event')
    expect(captured.length).toBe(1)
    const span = captured[0]
    expect(span.ended).toBe(true)
    expect(span.attributes['nzila.governance.event_type']).toBe(
      'doctrine_enforcement_event',
    )
    expect(span.attributes['nzila.governance.severity']).toBe('warning')
    expect(span.attributes['nzila.governance.product']).toBe('union-eyes')
    expect(span.attributes['nzila.governance.decision']).toBe('deny')
    expect(span.attributes['nzila.governance.doctrine_doc']).toBe(
      'docs/nzila-ip/pilot-discipline.md',
    )
  })

  it('refuses forbidden payload keys', () => {
    emitGovernanceSpan(envelope)
    const span = captured[0]
    expect(span.attributes['nzila.governance.payload.userId']).toBeUndefined()
    // Allowed payload keys are projected with the prefix.
    expect(span.attributes['nzila.governance.payload.count']).toBe('7')
    expect(span.attributes['nzila.governance.payload.label']).toBe('pilot-isolation')
  })
})

describe('withGovernanceSpan', () => {
  it('runs a function inside a governance span and returns its value', async () => {
    const result = await withGovernanceSpan(envelope, () => 42)
    expect(result).toBe(42)
    expect(captured[0].ended).toBe(true)
  })

  it('records exceptions and re-throws', async () => {
    await expect(
      withGovernanceSpan(envelope, () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(captured[0].ended).toBe(true)
  })
})

describe('FORBIDDEN_OTEL_ATTRIBUTE_KEYS', () => {
  it('matches the schema-layer person-resolving keys', () => {
    expect(FORBIDDEN_OTEL_ATTRIBUTE_KEYS.has('userId')).toBe(true)
    expect(FORBIDDEN_OTEL_ATTRIBUTE_KEYS.has('email')).toBe(true)
    expect(FORBIDDEN_OTEL_ATTRIBUTE_KEYS.has('count')).toBe(false)
  })
})
