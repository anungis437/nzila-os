import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'TrustCore',
  description: 'Privacy compliance and governance platform — Nzila OS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <html lang="en" data-product="trustcore">
        <body>
          <NzilaAppShell moduleId="trustcore">
            {children}
          </NzilaAppShell>
        </body>
      </html>
    </AuthProvider>
  )
}
