import { describe, expect, it } from 'vitest'
import { resolveEvidence } from './resolve'
import { recipientDispositionSchema } from './contracts'
import {
  SYNTHETIC_DISPOSITIONS,
  SYNTHETIC_EVIDENCE,
  SYNTHETIC_REQUIREMENTS,
} from './fixtures/synthetic-cross-institution'

const base = SYNTHETIC_REQUIREMENTS[0]!

describe('provider-neutral evidence resolution', () => {
  it('resolves the exact same evidence version independently for two recipients', () => {
    const first = resolveEvidence(SYNTHETIC_EVIDENCE, SYNTHETIC_REQUIREMENTS[0]!)
    const second = resolveEvidence(SYNTHETIC_EVIDENCE, SYNTHETIC_REQUIREMENTS[1]!)
    expect(first.evidence).toEqual(second.evidence)
    expect(first.state).toBe('MATCHED')
    expect(second.state).toBe('PARTIAL')
    expect(first.recipientId).not.toBe(second.recipientId)
    expect(first.requirementRef).not.toBe(second.requirementRef)
    expect(first.authorizationRef).not.toBe(second.authorizationRef)
  })

  it('preserves distinct recipient-owned synthetic dispositions separately from resolution', () => {
    const [first, second] = SYNTHETIC_DISPOSITIONS.map((disposition) =>
      recipientDispositionSchema.parse(disposition),
    )
    expect(first?.recipientId).not.toBe(second?.recipientId)
    expect(first?.authorityRef).not.toBe(second?.authorityRef)
    expect(first?.dispositionRef).not.toBe(second?.dispositionRef)
    expect(first?.value).not.toBe(second?.value)
    expect(resolveEvidence(SYNTHETIC_EVIDENCE, SYNTHETIC_REQUIREMENTS[0]!).state).toBe('MATCHED')
    expect(resolveEvidence(SYNTHETIC_EVIDENCE, SYNTHETIC_REQUIREMENTS[1]!).state).toBe('PARTIAL')
  })

  it.each([
    [{ ...base.evidenceCriterionStates, 'criterion-period': 'CONFLICT' }, 'CONFLICT'],
    [{ ...base.evidenceCriterionStates, 'criterion-period': 'UNKNOWN' }, 'PARTIAL'],
    [{ 'criterion-status': 'UNKNOWN', 'criterion-period': 'UNKNOWN' }, 'UNKNOWN'],
    [{ 'criterion-status': 'NOT_MET', 'criterion-period': 'NOT_MET' }, 'NOT_SATISFIED'],
  ] as const)(
    'returns the normative technical state without an institutional decision',
    (states, expected) => {
      const result = resolveEvidence(SYNTHETIC_EVIDENCE, {
        ...base,
        evidenceCriterionStates: states,
      })
      expect(result.state).toBe(expected)
      expect(result).not.toHaveProperty('disposition')
    },
  )

  it('fails closed for missing, wrong-recipient, expired, and revoked disclosure authorization', () => {
    const unknown = resolveEvidence(SYNTHETIC_EVIDENCE, {
      ...base,
      rights: { ...base.rights, disclosure: 'UNKNOWN' },
    })
    expect(unknown.state).toBe('NOT_AUTHORIZED')

    const wrongRecipient = resolveEvidence(SYNTHETIC_EVIDENCE, {
      ...base,
      rights: { ...base.rights, permittedRecipients: ['someone-else'] },
    })
    expect(wrongRecipient.state).toBe('NOT_AUTHORIZED')

    const expired = resolveEvidence(SYNTHETIC_EVIDENCE, {
      ...base,
      rights: { ...base.rights, expiresAt: '2026-02-28T00:00:00.000Z' },
    })
    expect(expired.state).toBe('EXPIRED')

    const revoked = resolveEvidence(SYNTHETIC_EVIDENCE, {
      ...base,
      rights: { ...base.rights, revokedAt: '2026-02-28T00:00:00.000Z' },
    })
    expect(revoked.state).toBe('NOT_AUTHORIZED')
  })

  it('marks source evidence outside its explicit validity period as expired', () => {
    expect(
      resolveEvidence(SYNTHETIC_EVIDENCE, {
        ...base,
        evidenceValidUntil: '2026-02-28T00:00:00.000Z',
      }).state,
    ).toBe('EXPIRED')
  })

  it('returns only stable evidence references, never source claim values or payload', () => {
    const result = resolveEvidence(SYNTHETIC_EVIDENCE, base)
    expect(JSON.stringify(result)).not.toMatch(/secret claim|payload/i)
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['evidence', 'state', 'recipientId', 'requirementRef']),
    )
  })

  it.each([
    [{ validFrom: '2026-04-01T00:00:00.000Z' }, 'UNKNOWN'],
    [{ validUntil: '2026-02-28T00:00:00.000Z' }, 'EXPIRED'],
    [{ freshness: 'STALE' }, 'UNKNOWN'],
  ] as const)(
    'keeps evidence validity and freshness distinct from disclosure rights',
    (metadata, state) => {
      expect(resolveEvidence({ ...SYNTHETIC_EVIDENCE, ...metadata }, base).state).toBe(state)
    },
  )

  it('does not silently treat a future or missing observation time as fresh', () => {
    const requirement = { ...base, maximumEvidenceAgeSeconds: 60 }
    expect(resolveEvidence(SYNTHETIC_EVIDENCE, requirement).state).toBe('UNKNOWN')
    expect(
      resolveEvidence(
        {
          ...SYNTHETIC_EVIDENCE,
          observedAt: '2026-04-01T00:00:00.000Z',
        },
        requirement,
      ).state,
    ).toBe('UNKNOWN')
  })
})
