import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Poppins } from 'next/font/google'
import { locales } from '@/lib/locales'
import AppShell from './components/AppShell'
import { AccessProvider } from './components/AccessProvider'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

type Params = { locale: string }

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<Params>
}) {
  const { locale } = await params
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${poppins.variable} ${poppins.className}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AccessProvider defaultActorKey="lissa">
            <AppShell locale={locale}>{children}</AppShell>
          </AccessProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}