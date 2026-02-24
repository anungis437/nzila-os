import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './lib/locales';

// Re-export locale constants from lib/locales.ts
// This allows middleware.ts to import locales without pulling in async imports
export { locales, defaultLocale, type Locale } from './lib/locales';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const validLocale = locale && locales.includes(locale as Locale) ? locale : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default,
    timeZone: 'America/Toronto', // Eastern Time (CLC headquarters in Ottawa)
    now: new Date()
  };
});
