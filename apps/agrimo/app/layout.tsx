import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Agrimo | Nzila OS',
    template: '%s | Agrimo',
  },
  description:
    'Agricultural operations platform — producers, harvests, lots, warehousing, shipments, payments.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <AuthProvider>
      <html lang={locale} data-product="agrimo">
        <body>
          <NzilaAppShell moduleId="agrimo">
            <NextIntlClientProvider locale={locale} messages={messages}>
              {children}
            </NextIntlClientProvider>
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
