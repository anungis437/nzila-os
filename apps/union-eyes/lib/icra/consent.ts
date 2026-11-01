import type { ConsentRecord } from '@/lib/icra/types'
import { DOCTRINE_VERSION } from '@/lib/icra/copy'

export const ICRA_LOCALES = ['en-CA', 'fr-CA'] as const
export const ICRA_DEFAULT_LOCALE = 'en-CA'

/** The largest JSON body an anonymous one-shot submission may send. The bank has at most 64 answers. */
export const ICRA_SUBMIT_MAX_BODY_BYTES = 64 * 1024

type Acknowledgements = {
  acknowledgedAntiSurveillance?: unknown
  acknowledgedDataHandling?: unknown
  acknowledgedExplainability?: unknown
}

export function acknowledgedAll(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const c = value as Acknowledgements
  return c.acknowledgedAntiSurveillance === true && c.acknowledgedDataHandling === true && c.acknowledgedExplainability === true
}

/**
 * The stored consent is evidence of what the server presented and when, so it is built here from the three
 * acknowledgements alone. A client-supplied time, doctrine version or extra key is never kept.
 */
export function serverConsentRecord(acknowledged: unknown, now: Date = new Date()): ConsentRecord | null {
  if (!acknowledgedAll(acknowledged)) return null
  return {
    acceptedAt: now.toISOString(),
    doctrineVersion: DOCTRINE_VERSION,
    acknowledgedAntiSurveillance: true,
    acknowledgedDataHandling: true,
    acknowledgedExplainability: true,
  }
}

/** A stored consent counts only when it carries the three acknowledgements and the server stamp. */
export function hasRecordedConsent(stored: unknown): boolean {
  if (!acknowledgedAll(stored)) return false
  const c = stored as Partial<ConsentRecord>
  return typeof c.acceptedAt === 'string' && c.acceptedAt.length > 0 && typeof c.doctrineVersion === 'string' && c.doctrineVersion.length > 0
}

/** Returns a supported locale, the default when none was sent, or null when the value is not one the column can hold. */
export function normalizeIcraLocale(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return ICRA_DEFAULT_LOCALE
  return typeof value === 'string' && (ICRA_LOCALES as readonly string[]).includes(value) ? value : null
}
