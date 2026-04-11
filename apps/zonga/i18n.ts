import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) ?? 'en-CA';

  // Bare language codes without region fall back to the regional variant
  if (locale === 'en') locale = 'en-CA';
  if (locale === 'fr') locale = 'fr-CA';

  let messages;
  try {
    messages = (await import(`./messages/${locale}.json`)).default;
  } catch {
    // Locale file not yet available — fall back to en-CA
    messages = (await import('./messages/en-CA.json')).default;
  }

  return { locale, messages };
});
