/**
 * Locale Configuration Constants
 * 
 * This file contains ONLY locale definitions with no dynamic imports.
 * Purpose: Allow proxy.ts (Edge runtime) to access locale constants
 * without importing i18n.ts which has async imports.
 * 
 * Keep in sync with i18n/config.ts
 * 
 * @module lib/locales
 */

// Supported locales (must match i18n/config.ts)
export const locales = ['en-CA', 'fr-CA', 'it', 'pt'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'en-CA';

/**
 * The BCP-47 tag Intl should format dates and numbers with, for a locale value from a route, a user, a member or an organization. The application's own locales are already
 * formatting tags ('en-CA', 'fr-CA'), so a screen's `useLocale()` passes through; a value stored elsewhere ('fr', 'fr_CA', 'FR-ca', 'en-US', 'english') is read by its language.
 * Anything unknown or missing formats as the default, en-CA. `english` keeps a site that has always rendered US English (numeric month-first dates, "AM"/"PM") rendering it for
 * English readers while every other language gets its own conventions.
 */
export function formattingLocale(value: string | null | undefined, english: 'en-CA' | 'en-US' = 'en-CA'): string {
  const token = (value ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (token.startsWith('fr')) return 'fr-CA';
  if (token === 'it' || token.startsWith('it-')) return 'it';
  if (token === 'pt' || token.startsWith('pt-')) return 'pt';
  return english;
}
