import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, type Locale } from './lib/locales';

export { locales, defaultLocale, type Locale } from './lib/locales';

const baseLangMap: Record<string, string> = {
  'en-CA': 'en',
  'fr-CA': 'fr',
};

function mergeMessages(
  base: Record<string, unknown>,
  localeSpecific: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(localeSpecific)) {
    const baseVal = base[key];
    const overrideVal = localeSpecific[key];
    if (
      baseVal && overrideVal &&
      typeof baseVal === 'object' && !Array.isArray(baseVal) &&
      typeof overrideVal === 'object' && !Array.isArray(overrideVal)
    ) {
      merged[key] = mergeMessages(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      merged[key] = overrideVal;
    }
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let requested = await requestLocale;

  // Without next-intl middleware routing, requestLocale may be undefined.
  // Fall back to the NEXT_LOCALE cookie set by our Clerk middleware.
  if (!requested) {
    try {
      const cookieStore = await cookies();
      requested = cookieStore.get('NEXT_LOCALE')?.value;
    } catch {
      // cookies() unavailable during build / static generation — use default
    }
  }

  const validLocale = requested && locales.includes(requested as Locale) ? requested : defaultLocale;

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
