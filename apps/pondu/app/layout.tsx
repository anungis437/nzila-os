import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Pondu Ops | Nzila OS',
    template: '%s | Pondu Ops',
  },
  description:
    'Agricultural operations platform — producers, harvests, lots, warehousing, shipments, payments.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
