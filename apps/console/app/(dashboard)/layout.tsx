import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@nzila/platform-auth/entra/client'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ExecutiveModeWrapper } from './executive-mode'
import { SidebarNav } from '@/components/sidebar-nav'
import { CommandSectionGuide } from '@/components/command-section-guide'
import { CommandPalette } from '@/components/command-palette'
import { MobileShell } from '@/components/mobile-shell'
import { WebVitalsReporter } from '@/components/web-vitals-reporter'
import { navGroups, appLinks } from '@/lib/nav-config'
import { buildPaletteItems } from '@/lib/palette'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth gate — runs on Node.js (not Edge) so crypto.subtle works.
  // Middleware only sets up auth context; this layout enforces authentication.
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const paletteItems = buildPaletteItems()

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-gray-100 hidden md:block">
        <Link href="/console" className="text-xl font-bold text-blue-600">
          Nzila Console
        </Link>
      </div>
      <SidebarNav groups={navGroups} />

      {/* App Launcher */}
      <div className="px-3 pb-2 border-t border-gray-100 pt-3">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Launch App</p>
        {appLinks.map((app) => (
          app.href ? (
            <a
              key={app.name}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition"
            >
              <span className="flex items-center gap-2">
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                {app.name}
              </span>
              <span className="text-xs text-gray-400 font-mono">{app.badge}</span>
            </a>
          ) : (
            <div key={app.name} className="flex items-center justify-between px-3 py-2 text-sm text-amber-700 rounded-lg bg-amber-50">
              <span>{app.name}</span>
              <span className="text-xs">Not configured</span>
            </div>
          )
        ))}
      </div>
      <div className="p-4 border-t border-gray-100 flex items-center gap-3">
        <UserButton />
        <span className="text-sm text-gray-500">Account</span>
      </div>
    </>
  )

  // Desktop sidebar — hidden on mobile (drawer takes over)
  const sidebar = (
    <aside className="hidden md:flex w-64 border-r border-gray-200 bg-white flex-col">
      {sidebarContent}
    </aside>
  )

  return (
    <>
      {/* Mobile top bar + drawer (hosts the same nav content) */}
      <MobileShell sidebar={sidebarContent} />

      <ExecutiveModeWrapper sidebar={sidebar}>
        <>
          <CommandSectionGuide />
          {children}
        </>
      </ExecutiveModeWrapper>

      {/* Global command palette (⌘K / Ctrl+K) */}
      <CommandPalette items={paletteItems} />

      {/* Web Vitals beacon — reports to /api/_perf/vitals on visibility change. */}
      <WebVitalsReporter />
    </>
  )
}
