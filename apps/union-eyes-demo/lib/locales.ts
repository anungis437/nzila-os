/**
 * Locale constants for the demo app.
 *
 * Wave 0 §3: demo has its own locale surface, independent from the
 * operational app. Only the two bilingual-first Canadian locales are
 * enabled — the demo does not ship the extended language matrix.
 */
export const locales = ['en-CA', 'fr-CA'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-CA';
