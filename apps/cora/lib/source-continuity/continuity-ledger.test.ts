import { describe, expect, it } from 'vitest'
import {
  appendContinuityEvent,
  type ContinuityEvent,
  type ContinuityLedger,
} from './continuity-ledger'
import {
  SYNTHETIC_ORG_ID,
  SYNTHETIC_PURPOSE,
  SYNTHETIC_RECIPIENT_ID,
  SYNTHETIC_TIME,
  buildSyntheticRouteFixture,
} from './fixtures/synthetic-routes'

function event(
  eventId: string,
  eventType: ContinuityEvent['eventType'],
  overrides: Partial<ContinuityEvent> = {},
): ContinuityEvent {
  return {
    eventId,
    lineageId: 'synthetic-lineage-001',
    orgId: SYNTHETIC_ORG_ID,
    eventType,
    occurredAt: SYNTHETIC_TIME,
    actorId: 'synthetic-actor-001',
    purpose: SYNTHETIC_PURPOSE,
    recipientId: SYNTHETIC_RECIPIENT_ID,
    rights: buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR').capture.rights,
    ...(eventType === 'MAPPING_APPLIED' ? { mappingVersion: '1.0.0' } : {}),
    ...(eventType === 'CAPTURED' || eventType === 'CAPSULE_ASSEMBLED' || eventType === 'EXPORTED'
      ? { integritySha256: 'a'.repeat(64) }
      : {}),
    ...overrides,
  }
}

describe('append-only continuity ledger', () => {
  it('accepts only a valid capture-to-export transition sequence', () => {
    let ledger: ContinuityLedger = []
    const sequence: ContinuityEvent[] = [
      event('event-1', 'CAPTURED'),
      event('event-2', 'CAPTURE_VALIDATED'),
      event('event-3', 'MAPPING_APPLIED'),
      event('event-4', 'CAPSULE_ASSEMBLED'),
      event('event-5', 'EXPORTED'),
    ]
    for (const next of sequence) {
      ledger = appendContinuityEvent(ledger, next, SYNTHETIC_ORG_ID)
    }
    expect(ledger.map((item) => item.eventType)).toEqual([
      'CAPTURED',
      'CAPTURE_VALIDATED',
      'MAPPING_APPLIED',
      'CAPSULE_ASSEMBLED',
      'EXPORTED',
    ])
  })

  it('rejects impossible transitions, duplicate IDs, and cross-tenant writes', () => {
    expect(() =>
      appendContinuityEvent([], event('event-1', 'MAPPING_APPLIED'), SYNTHETIC_ORG_ID),
    ).toThrow(/Invalid continuity transition/)

    const captured = appendContinuityEvent([], event('event-1', 'CAPTURED'), SYNTHETIC_ORG_ID)
    expect(() =>
      appendContinuityEvent(captured, event('event-1', 'CAPTURE_VALIDATED'), SYNTHETIC_ORG_ID),
    ).toThrow(/Duplicate/)
    expect(() =>
      appendContinuityEvent(
        captured,
        event('event-2', 'CAPTURE_VALIDATED', { orgId: 'other-org' }),
        SYNTHETIC_ORG_ID,
      ),
    ).toThrow(/trusted Cora organization/)
  })

  it('keeps source truth changes distinct from Cora interpretation changes', () => {
    const captured = appendContinuityEvent([], event('event-1', 'CAPTURED'), SYNTHETIC_ORG_ID)
    const sourceChange = appendContinuityEvent(
      captured,
      event('event-2', 'SOURCE_TRUTH_CHANGED', { changeRef: 'source-event-2' }),
      SYNTHETIC_ORG_ID,
    )
    const interpretationChange = appendContinuityEvent(
      sourceChange,
      event('event-3', 'CORA_INTERPRETATION_CHANGED', {
        changeRef: 'mapping-review-3',
      }),
      SYNTHETIC_ORG_ID,
    )
    expect(interpretationChange.map((item) => item.eventType)).toEqual([
      'CAPTURED',
      'SOURCE_TRUTH_CHANGED',
      'CORA_INTERPRETATION_CHANGED',
    ])
  })
})
