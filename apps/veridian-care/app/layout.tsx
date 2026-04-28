import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { SyntheticWarning } from '@/components/synthetic-warning'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Veridian Care — Clinician Portal',
    template: '%s | Veridian Care',
  },
  description: 'Veridian Care clinician portal — synthetic demo environment',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-product="veridian">
      <body className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <SyntheticWarning />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
