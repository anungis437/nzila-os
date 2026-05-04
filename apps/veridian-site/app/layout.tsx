import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Footer } from '@/components/footer'
import { SyntheticWarning } from '@/components/synthetic-warning'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Veridian Care — One patient story. Every location.',
    template: '%s | Veridian Care',
  },
  description:
    'Veridian Care is a trusted interoperability platform for continuity of care across fragmented healthcare systems.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_VERIDIAN_SITE_URL ?? 'https://veridiancare.health',
  ),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <SyntheticWarning />
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
