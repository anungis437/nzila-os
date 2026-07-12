import type { Metadata } from 'next'
import { AuthProvider } from '@nzila/platform-auth/entra/client'
import { NzilaAppShell } from '@nzila/platform-shell'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'NzilaOS Platform Admin',
  description: 'Platform ontology, entity graph, and AI operations explorer',
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/ontology', label: 'Ontology' },
  { href: '/entity-graph', label: 'Entity Graph' },
  { href: '/events', label: 'Events' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/decisions', label: 'Decisions' },
  { href: '/ai-runs', label: 'AI Runs' },
  { href: '/reasoning', label: 'Reasoning' },
  { href: '/search', label: 'Search' },
  { href: '/data-fabric', label: 'Data Fabric' },
  { href: '/orchestrator-ops', label: 'Orchestrator Ops' },
  { href: '/platform-health', label: 'Platform Health' },
  { href: '/integration-ops', label: 'Integration Ops' },
  { href: '/itsm-config', label: 'Service Ops Config' },
  { href: '/sage', label: 'SAGE' },
] as const

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <AuthProvider>
      <html lang={locale}>
        <body className="bg-gray-50 text-gray-900 antialiased">
          <NzilaAppShell moduleId="platform-admin">
          <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <nav className="w-64 border-r border-gray-200 bg-white px-4 py-6">
              <h1 className="mb-8 text-lg font-bold tracking-tight">
                NzilaOS Admin
              </h1>
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        </NextIntlClientProvider>
        </NzilaAppShell>
      </body>
    </html>
    </AuthProvider>
  )
}
