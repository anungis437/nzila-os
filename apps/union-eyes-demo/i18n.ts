/**
 * next-intl request configuration for the demo app.
 *
 * Loads locale-scoped messages at request time. Demo locales are
 * limited to `en-CA` and `fr-CA` (see `lib/locales.ts`).
 */
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './lib/locales';

export { locales, defaultLocale, type Locale } from './lib/locales';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const validLocale: Locale =
    requested && (locales as readonly string[]).includes(requested)
      ? (requested as Locale)
      : defaultLocale;

  const messages = (await import(`./messages/${validLocale}.json`)).default as Record<string, unknown>;

  return {
    locale: validLocale,
    messages,
  };
});
