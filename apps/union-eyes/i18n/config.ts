// i18n Configuration for UnionEyes
// Supports Canadian English (en-CA), Canadian French (fr-CA), Italian (it), and Portuguese (pt)

export const locales = ['en-CA', 'fr-CA', 'it', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-CA';

export const localeNames: Record<Locale, string> = {
  'en-CA': 'English (Canada)',
  'fr-CA': 'Français (Canada)',
  'it': 'Italiano',
  'pt': 'Português',
};

export const localeFlags: Record<Locale, string> = {
  'en-CA': '🇨🇦', // Canadian English
  'fr-CA': '🇨🇦', // Canadian French (Quebec)
  'it': '🇮🇹',    // Italian
  'pt': '🇵🇹',    // Portuguese
};

// Fallback mapping - base locale falls back to itself
export const localeFallbacks: Record<Locale, Locale> = {
  'en-CA': 'en-CA',
  'fr-CA': 'fr-CA',
  'it': 'it',
  'pt': 'pt',
};

