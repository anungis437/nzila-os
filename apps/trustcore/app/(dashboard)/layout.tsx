/**
 * TrustCore — Dashboard Shell Layout
 *
 * Wraps all /dashboard routes with:
 *  - org-scoped auth gate (redirects to /sign-in on failure)
 *  - sidebar navigation
 *  - top bar with org context + user indicator
 *  - main content slot
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@nzila/platform-auth/entra/server'
import { TrustCoreSidebar } from '@/components/shared/TrustCoreSidebar'
import { TrustCoreLocaleToggle } from '@/components/shared/TrustCoreLocaleToggle'
import { TrustCoreAccountMenu } from '@/components/shared/TrustCoreAccountMenu'
import { getAuthContextOrNull } from '@/lib/auth/getAuthContext'

export const dynamic = 'force-dynamic'

function resolveLocale(rawLocale: string | undefined): 'en-CA' | 'fr-CA' {
  if (rawLocale === 'en' || rawLocale === 'en-CA') return 'en-CA'
  if (rawLocale === 'fr' || rawLocale === 'fr-CA') return 'fr-CA'
  return 'fr-CA'
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value)
  const lang = locale === 'fr-CA' ? 'fr' : 'en'

  const ctx = await getAuthContextOrNull()
  if (!ctx) redirect('/sign-in')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <TrustCoreSidebar lang={lang} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Org
            </span>
            <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
              {ctx.orgId}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
              {ctx.role}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <TrustCoreLocaleToggle locale={locale} />
            <TrustCoreAccountMenu userId={ctx.userId} lang={lang} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
