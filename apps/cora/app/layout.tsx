import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Cora Insights | Nzila OS',
    template: '%s | Cora Insights',
  },
  description:
    'Agricultural intelligence platform — yield forecasts, price signals, risk analysis, traceability.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <AuthProvider>
      <html lang={locale}>
        <body>
          <NzilaAppShell moduleId="cora">
            <NextIntlClientProvider locale={locale} messages={messages}>
              {children}
            </NextIntlClientProvider>
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
