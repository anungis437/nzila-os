export const locales = ['en-CA', 'fr-CA'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-CA';

export const localeNames: Record<Locale, string> = {
  'en-CA': 'English (Canada)',
  'fr-CA': 'Français (Canada)',
};
