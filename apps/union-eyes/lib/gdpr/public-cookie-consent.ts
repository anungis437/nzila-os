/**
 * Public cookie-consent receipts must not expose internal identity, IP, user-agent,
 * organization or audit metadata. The consentId is a browser-held random identifier,
 * not an authentication credential or an authority grant.
 */
export interface PublicCookieConsentSource {
  consentId: string
  essential: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
  expiresAt?: Date | null
  lastUpdated?: Date | null
}

export function publicCookieConsent(source: PublicCookieConsentSource) {
  return {
    consentId: source.consentId,
    essential: source.essential,
    functional: source.functional,
    analytics: source.analytics,
    marketing: source.marketing,
    expiresAt: source.expiresAt ?? null,
    lastUpdated: source.lastUpdated ?? null,
  }
}
