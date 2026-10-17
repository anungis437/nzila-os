import { describe, expect, it } from 'vitest'
import { evaluateRights } from './rights'
import {
  SYNTHETIC_PURPOSE,
  SYNTHETIC_RECIPIENT_ID,
  SYNTHETIC_TIME,
  buildSyntheticRouteFixture,
} from './fixtures/synthetic-routes'

describe('source-continuity rights', () => {
  it('fails closed independently for every required right', () => {
    const { capture } = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const required = [
      ['sourceAccess', 'CAPTURE'],
      ['transientProcessing', 'CAPTURE'],
      ['persistence', 'PERSIST'],
      ['transformation', 'TRANSFORM'],
      ['disclosure', 'DISCLOSE'],
      ['export', 'EXPORT'],
      ['rehydration', 'REHYDRATE'],
      ['deletion', 'DELETE'],
      ['retentionAfterDisconnect', 'PERSIST'],
    ] as const

    for (const [right, action] of required) {
      const result = evaluateRights({ ...capture.rights, [right]: 'UNKNOWN' }, action, {
        purpose: SYNTHETIC_PURPOSE,
        recipientId: SYNTHETIC_RECIPIENT_ID,
        at: SYNTHETIC_TIME,
      })
      expect(result.allowed).toBe(false)
    }
  })

  it('authorizes revocation only for an explicit authority in the rights record', () => {
    const { capture } = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const unauthorized = evaluateRights(capture.rights, 'REVOKE', {
      purpose: SYNTHETIC_PURPOSE,
      recipientId: SYNTHETIC_RECIPIENT_ID,
      at: SYNTHETIC_TIME,
      actorId: 'unapproved-actor',
    })
    expect(unauthorized).toEqual({
      allowed: false,
      reasons: ['REVOCATION_ACTOR_NOT_AUTHORIZED'],
    })
  })

  it('denies conditional rights until a separate trusted condition evaluator exists', () => {
    const { capture } = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const result = evaluateRights(
      { ...capture.rights, persistence: 'ALLOWED_WITH_CONDITIONS' },
      'PERSIST',
      {
        purpose: SYNTHETIC_PURPOSE,
        recipientId: SYNTHETIC_RECIPIENT_ID,
        at: SYNTHETIC_TIME,
      },
    )
    expect(result).toEqual({
      allowed: false,
      reasons: ['PERSISTENCE_CONDITIONS_NOT_VERIFIED'],
    })
  })

  it('enforces purpose, recipient, expiry, and revocation scope', () => {
    const { capture } = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
    const wrongRecipient = evaluateRights(capture.rights, 'EXPORT', {
      purpose: SYNTHETIC_PURPOSE,
      recipientId: 'unapproved-recipient',
      at: SYNTHETIC_TIME,
    })
    expect(wrongRecipient.reasons).toContain('RECIPIENT_NOT_AUTHORIZED')

    const expired = evaluateRights(
      { ...capture.rights, expiresAt: '2026-02-10T11:00:00.000Z' },
      'CAPTURE',
      {
        purpose: SYNTHETIC_PURPOSE,
        recipientId: SYNTHETIC_RECIPIENT_ID,
        at: SYNTHETIC_TIME,
      },
    )
    expect(expired.reasons).toContain('RIGHTS_EXPIRED')
  })
})
