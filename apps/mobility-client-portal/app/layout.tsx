import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'Global Mobility OS — Client Portal',
  description: 'Track your immigration case, upload documents, and communicate with your advisor.',
  openGraph: {
    title: 'Global Mobility OS — Client Portal',
    description: 'Track your case, upload documents, and message your advisor — all in one secure portal.',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop&q=80',
        width: 1200,
        height: 630,
        alt: 'Professional reviewing documents — Global Mobility Client Portal',
      },
    ],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <AuthProvider>
      <html lang={locale} className={poppins.variable}>
        <body className="min-h-screen bg-[var(--background)] text-gray-900 antialiased">
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </AuthProvider>
  )
}
