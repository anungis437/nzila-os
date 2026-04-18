/**
 * Locale Configuration Constants
 *
 * Edge-safe locale definitions — no dynamic imports.
 * Allows proxy.ts (Edge runtime) to access locale constants.
 *
 * @module lib/locales
 */
export const locales = ['en-CA', 'fr-CA'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-CA';
