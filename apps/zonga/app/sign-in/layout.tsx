/**
 * Sign-In Layout — Provides i18n context for the auth pages.
 * Reads NEXT_LOCALE cookie to provide translations via NextIntlClientProvider.
 */
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';

async function loadMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch {
    return (await import('@/messages/en-CA.json')).default;
  }
}

export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en-CA';
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
