import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './lib/locales';
import { loadMessages } from './lib/i18n/messages';

// Re-export locale constants from lib/locales.ts
// This allows proxy.ts to import locales without pulling in async imports
export { locales, defaultLocale, type Locale } from './lib/locales';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const validLocale = requested && locales.includes(requested as Locale) ? requested : defaultLocale;

  // The locale's own catalog over its base language's, to the root of the chain (lib/i18n/messages.ts)
  const messages = await loadMessages(validLocale, async (catalog) => (await import(`./messages/${catalog}.json`)).default);

  return {
    locale: validLocale,
    messages,
    timeZone: 'America/Toronto', // Eastern Time (CLC headquarters in Ottawa)
    now: new Date()
  };
});
