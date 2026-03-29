import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'Global Mobility OS — Advisory Platform for Investment Migration',
  description:
    'AI-powered investment migration management. Program eligibility, compliance workflows, client lifecycle — one platform for 40+ residency and citizenship programs.',
  openGraph: {
    title: 'Global Mobility OS — Advisory Platform for Investment Migration',
    description:
      'Empowering migration advisors with intelligent program matching, compliance automation, and end-to-end case management across 25+ countries.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200&h=630&fit=crop&q=80',
        width: 1200,
        height: 630,
        alt: 'Global travel and migration — Global Mobility OS platform',
      },
    ],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <ClerkProvider>
      <html lang={locale} className={poppins.variable}>
        <body>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
