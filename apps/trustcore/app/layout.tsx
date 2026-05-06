import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'TrustCore',
  description: 'Privacy compliance and governance platform — Nzila OS',
}

function resolveLang(rawLocale: string | undefined): 'en' | 'fr' {
  if (rawLocale === 'fr' || rawLocale === 'fr-CA') return 'fr'
  return 'en'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const lang = resolveLang(cookieStore.get('NEXT_LOCALE')?.value)

  return (
    <AuthProvider>
      <html lang={lang} data-product="trustcore">
        <body className={poppins.className}>
          <NzilaAppShell moduleId="trustcore">
            {children}
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
