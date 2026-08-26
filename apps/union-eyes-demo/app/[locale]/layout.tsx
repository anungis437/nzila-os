/**
 * Union Eyes Demo — locale-scoped layout.
 *
 * Passes through children under a next-intl provider bound to the
 * validated locale. The root layout mounts NextIntlClientProvider
 * with the request-locale messages; this layout enforces that the
 * requested locale is one of the supported demo locales.
 */
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/locales';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(locales as readonly string[]).includes(locale)) {
    notFound();
  }
  return <>{children}</>;
}

// Enforce the demo-locale type at compile time.
export const dynamicParams: false = false;
export type _EnforceLocale = Locale;
