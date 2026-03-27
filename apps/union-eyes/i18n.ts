import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './lib/locales';

// Re-export locale constants from lib/locales.ts
// This allows middleware.ts to import locales without pulling in async imports
export { locales, defaultLocale, type Locale } from './lib/locales';

// Map region locales to their base language for fallback
const baseLangMap: Record<string, string> = {
  'en-CA': 'en',
  'fr-CA': 'fr',
};

// Merge base language messages with locale-specific overrides.
// Top-level keys from locale-specific files take precedence;
// missing top-level keys fall back to the base language file.
function mergeMessages(
  base: Record<string, unknown>,
  localeSpecific: Record<string, unknown>
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
        overrideVal as Record<string, unknown>
      );
    } else {
      merged[key] = overrideVal;
    }
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const validLocale = requested && locales.includes(requested as Locale) ? requested : defaultLocale;

  const localeMessages = (await import(`./messages/${validLocale}.json`)).default;

  // For region locales (en-CA, fr-CA), merge base language messages underneath
  const baseLang = baseLangMap[validLocale];
  let messages = localeMessages;
  if (baseLang) {
    const baseMessages = (await import(`./messages/${baseLang}.json`)).default;
    messages = mergeMessages(baseMessages, localeMessages);
  }

  return {
    locale: validLocale,
    messages,
    timeZone: 'America/Toronto', // Eastern Time (CLC headquarters in Ottawa)
    now: new Date()
  };
});
