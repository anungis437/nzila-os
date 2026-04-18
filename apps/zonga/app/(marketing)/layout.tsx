/**
 * Marketing Layout — Shell for all public-facing Zonga pages.
 * Reads NEXT_LOCALE cookie to provide translations via NextIntlClientProvider.
 */
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import SiteNavigation from '@/components/public/site-navigation';
import SiteFooter from '@/components/public/site-footer';
import SupportWidgetShell from '@/components/public/support-widget-shell';

async function loadMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch {
    return (await import('@/messages/en-CA.json')).default;
  }
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en-CA';
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SiteNavigation />
      <main className="pt-16 md:pt-20">{children}</main>
      <SiteFooter />
      <SupportWidgetShell />
    </NextIntlClientProvider>
  );
}
