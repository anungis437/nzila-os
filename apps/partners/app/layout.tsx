import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nzila Partner Portal',
  description: 'World-class partner relationship hub — deal registration, commissions, certifications, co-marketing, and API integrations.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <AuthProvider>
      <html lang={locale}>
        <body>
          <NzilaAppShell moduleId="partners">
            <NextIntlClientProvider locale={locale} messages={messages}>
              {children}
            </NextIntlClientProvider>
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
