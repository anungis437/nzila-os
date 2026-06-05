import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale, defaultLocale } from './config';

export default getRequestConfig(async ({ locale }) => {
  const candidateLocale = typeof locale === 'string' ? locale : '';
  const validLocale = ((locales as readonly string[]).includes(candidateLocale)
    ? candidateLocale
    : defaultLocale) as Locale;

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
    timeZone: 'America/Toronto',
  };
});
