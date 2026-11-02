import { describe, expect, it } from 'vitest'
import { governanceEventEnvelopeSchema } from './schemas'

const event = { id: 'evt-12345678', schemaVersion: '1.0.0', type: 'governance_warning', severity: 'info', scope: { product: 'platform', environment: 'dev', environmentClass: 'development' }, subject: { kind: 'route', id: '/test' }, releaseId: 'release-1', emittedAt: '2026-11-02T12:00:00.000Z', payload: { count: 1 } } as const

describe('Zod 4 governance event envelope boundaries', () => {
  it('preserves safe aggregate event dictionaries', () => {
    expect(governanceEventEnvelopeSchema.parse(event).payload).toEqual({ count: 1 })
  })
  it('rejects individual-resolving payload keys, arrays and uncited warnings', () => {
    expect(governanceEventEnvelopeSchema.safeParse({ ...event, payload: { email: 'private@example.ca' } }).success).toBe(false)
    expect(governanceEventEnvelopeSchema.safeParse({ ...event, payload: [] }).success).toBe(false)
    expect(governanceEventEnvelopeSchema.safeParse({ ...event, severity: 'warning' }).success).toBe(false)
  })
})
