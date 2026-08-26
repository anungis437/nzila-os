/**
 * Union Eyes Demo — root layout.
 *
 * Wave 0 §3: this is the app-wide entrypoint for the demo artifact.
 * It intentionally does NOT reach into the operational
 * `apps/union-eyes` (no shared layout, no shared providers). The
 * synthetic-data banner is mounted here so it is visible on every
 * demo page regardless of route.
 */
import type { Metadata, Viewport } from 'next';
import { getLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

import { SyntheticDataBanner } from '@/components/SyntheticDataBanner';
import { DEMO_ENV } from '@/env';
import './globals.css';

// Read once to trigger the boot-time environment assertion.
void DEMO_ENV;

export const viewport: Viewport = {
  themeColor: '#12324a',
};

export const metadata: Metadata = {
  title: {
    default: 'Union Eyes Demo — Synthetic Data',
    template: '%s | Union Eyes Demo',
  },
  description:
    'Synthetic-data demonstration workspace for Union Eyes. Contains no real member records and cannot cause external side effects.',
  robots: { index: false, follow: false, nocache: true, noarchive: true },
  other: {
    'x-nzila-environment': 'demo',
    'x-nzila-artifact': '@nzila/union-eyes-demo',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SyntheticDataBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
