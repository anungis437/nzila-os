export const locales = ['en-CA', 'fr-CA'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-CA';

/** Routing object expected by [locale]/layout.tsx locale validation */
export const routing = { locales, defaultLocale };
