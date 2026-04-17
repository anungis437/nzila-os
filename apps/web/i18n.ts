import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './lib/locales';
import { mergeMessages, normalizeLocaleCandidate } from './lib/i18n-utils';

export { locales, defaultLocale, type Locale } from './lib/locales';

const baseLangMap: Record<string, string> = {
  'en-CA': 'en',
  'fr-CA': 'fr',
};

export default getRequestConfig(async ({ requestLocale }) => {
  let requested = await requestLocale;

  // Without next-intl middleware routing, requestLocale may be undefined.
  // Fall back to the NEXT_LOCALE cookie set by our auth middleware.
  if (!requested) {
    try {
      const cookieStore = await cookies();
      requested = cookieStore.get('NEXT_LOCALE')?.value;
    } catch {
      // cookies() unavailable during build / static generation — use default
    }
  }

  const validLocale = normalizeLocaleCandidate(requested, locales) ?? defaultLocale;

  const localeMessages = (await import(`./messages/${validLocale}.json`)).default;

  const baseLang = baseLangMap[validLocale];
  let messages = localeMessages;
  if (baseLang) {
    const baseMessages = (await import(`./messages/${baseLang}.json`)).default;
    messages = mergeMessages(baseMessages, localeMessages);
  }

  return {
    locale: validLocale,
    messages,
    timeZone: 'America/Toronto',
    now: new Date(),
  };
});
