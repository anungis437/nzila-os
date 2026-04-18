/**
 * Locale Configuration Constants
 * 
 * This file contains ONLY locale definitions with no dynamic imports.
 * Purpose: Allow proxy.ts (Edge runtime) to access locale constants
 * without importing i18n.ts which has async imports.
 * 
 * @module lib/locales
 */

// Supported locales
export const locales = ['en-CA', 'fr-CA', 'it', 'pt'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'en-CA';
