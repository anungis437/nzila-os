import type { Metadata } from 'next'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en" data-product="trustcore">
        <body className={poppins.className}>
          <NzilaAppShell moduleId="trustcore">
            {children}
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
