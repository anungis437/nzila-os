// i18n Request Configuration
// This file configures the internationalization settings for the application

import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale, defaultLocale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  // If invalid, fall back to default locale instead of calling notFound()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validLocale = (locales.includes(locale as any) ? locale : defaultLocale) as Locale;

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
    timeZone: 'America/Toronto', // Default timezone for Canadian users
  };
});

