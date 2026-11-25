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

/**
 * The locale an unprefixed request is served in: the NEXT_LOCALE cookie the language switcher and the locale routes set, else the browser's first language, else the
 * default. One rule for the edge redirect and for pages that have no locale segment.
 */
export function preferredLocale(cookieHeader: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  const cookie = (cookieHeader ?? '').match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i)?.[1]?.toLowerCase();
  if (cookie?.startsWith('fr')) return 'fr-CA';
  if (cookie?.startsWith('en')) return 'en-CA';
  const first = (acceptLanguage ?? '')
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .find(Boolean);
  if (first?.startsWith('fr')) return 'fr-CA';
  return defaultLocale;
}

/**
 * Entry pages that exist under a locale segment and are linked, emailed or redirected to without one. The edge sends them to the reader's language, keeping the query
 * string (reset tokens, return paths) intact.
 */
export const UNPREFIXED_AUTH_ENTRY_PATHS = ['/login', '/signup', '/sign-up'] as const;

export function localizedAuthEntryPath(pathname: string): string | null {
  const entry = UNPREFIXED_AUTH_ENTRY_PATHS.find((path) => pathname === path || pathname === `${path}/`);
  return entry ?? null;
}
