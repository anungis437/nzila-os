import { describe, expect, it } from 'vitest'
import { publicCookieConsent } from '../public-cookie-consent'

describe('public cookie-consent response', () => {
  const internal = {
    id: 'internal-row-id',
    consentId: 'browser-consent-uuid',
    userId: 'private-platform-user',
    organizationId: 'private-organization',
    ipAddress: '203.0.113.15',
    userAgent: 'private-device-fingerprint',
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    lastUpdated: new Date('2026-10-29T00:00:00Z'),
    notes: 'must not leak',
  }

  it('allows only the browser-facing preference and expiry fields', () => {
    const result = publicCookieConsent(internal)
    expect(Object.keys(result).sort()).toEqual([
      'analytics', 'consentId', 'essential', 'expiresAt', 'functional', 'lastUpdated', 'marketing',
    ])
    expect(result).toMatchObject({
      consentId: 'browser-consent-uuid',
      essential: true,
      functional: true,
      analytics: false,
      marketing: false,
    })
  })

  it('does not return identity, organization, IP, user-agent or internal metadata from POST/GET receipts', () => {
    const serialized = JSON.stringify(publicCookieConsent(internal))
    for (const secret of [
      internal.id, internal.userId, internal.organizationId, internal.ipAddress,
      internal.userAgent, internal.notes,
    ]) expect(serialized).not.toContain(secret)
  })

  it('handles missing expiry values without copying unexpected fields', () => {
    expect(publicCookieConsent({
      consentId: 'anon', essential: true, functional: false, analytics: false, marketing: false,
    })).toEqual({
      consentId: 'anon',
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
      expiresAt: null,
      lastUpdated: null,
    })
  })
})
