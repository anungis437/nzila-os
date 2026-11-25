import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { preferredLocale } from '@/lib/locales';

/**
 * Password recovery pages are linked and emailed without a locale segment, so no locale layout wraps them. Their forms read translations in the browser, which needs a
 * provider; the reader's language comes from the same cookie and header rule the edge uses.
 */
export async function UnprefixedAuthIntl({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const locale = preferredLocale(requestHeaders.get('cookie'), requestHeaders.get('accept-language'));
  const messages = await getMessages({ locale });
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
