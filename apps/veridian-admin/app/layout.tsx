import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AdminSidebar } from '@/components/admin-sidebar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Veridian Admin — Network Administration',
    template: '%s | Veridian Admin',
  },
  description: 'Veridian Care network administration portal — synthetic demo environment',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <div className="w-full bg-amber-400 text-amber-900 px-6 py-3 text-sm font-semibold flex items-center gap-2 border-b border-amber-500 shrink-0">
            <span className="text-lg">⚠</span>
            <span>
              SYNTHETIC DEMO ENVIRONMENT — All data is fabricated for demonstration purposes. No
              real operational or patient data is present.
            </span>
          </div>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
