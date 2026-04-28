import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { MobileShell } from '@/components/shell/MobileShell'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { resolveOrgContext } from '@/lib/resolve-org'
import { buildPaletteItems } from '@/lib/palette'
import { getHqRepository } from '@/server/repository'

export const metadata: Metadata = {
  title: 'Nzila HQ',
  description:
    'Executive operating cockpit for Nzila Ventures — portfolio, pipeline, founder dependency, delegation.',
}

// Cockpit is gated by per-request auth (resolveOrgContext); never prerender at build time.
export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await resolveOrgContext()
  const paletteItems = buildPaletteItems(context.role, getHqRepository())

  return (
    <html lang="en-CA" data-product="hq">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <div className="hidden md:block">
            <Sidebar role={context.role} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileShell role={context.role} />
            <div className="hidden md:block">
              <TopBar context={context} />
            </div>
            <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 md:px-8 md:py-8">
              {children}
            </main>
          </div>
        </div>
        <CommandPalette items={paletteItems} />
      </body>
    </html>
  )
}
