import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import {
  HomeIcon,
  RocketLaunchIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  FolderOpenIcon,
  CommandLineIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline'
import { platformDb } from '@nzila/db/platform'
import { partners } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { nextTier } from '@/lib/tier-gates'

const navItems = [
  { label: 'Dashboard', href: '/portal', icon: HomeIcon },
  { label: 'Deals', href: '/portal/deals', icon: RocketLaunchIcon },
  { label: 'Commissions', href: '/portal/commissions', icon: CurrencyDollarIcon },
  { label: 'Certifications', href: '/portal/certifications', icon: AcademicCapIcon },
  { label: 'Assets', href: '/portal/assets', icon: FolderOpenIcon },
  { label: 'API Hub', href: '/portal/api-hub', icon: CommandLineIcon },
  { label: 'GTM Center', href: '/portal/gtm', icon: MegaphoneIcon },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  // Resolve partner tier from DB
  let tierName = 'Registered'
  let tierProgress = 20
  let tierNext = 'Select'
  let partnerType: 'channel' | 'isv' | 'enterprise' = 'channel'

  if (orgId) {
    const [partner] = await platformDb
      .select({ tier: partners.tier, type: partners.type })
      .from(partners)
      .where(eq(partners.clerkOrgId, orgId))
      .limit(1)

    if (partner) {
      tierName = partner.tier.charAt(0).toUpperCase() + partner.tier.slice(1)
      partnerType = (partner.type as typeof partnerType) ?? 'channel'
      const next = nextTier(partner.tier as Parameters<typeof nextTier>[0], partnerType)
      tierNext = next ? next.charAt(0).toUpperCase() + next.slice(1) : 'Max'
      // Progress: map tier level (0-3) to approximate percentage
      const tierLevels: Record<string, number> = { registered: 20, select: 40, certified: 40, professional: 40, premier: 65, advanced: 65, enterprise: 65, elite: 100, strategic: 100 }
      tierProgress = tierLevels[partner.tier] ?? 20
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
          <div className="w-7 h-7 bg-blue-600 rounded-lg" />
          <span className="font-bold text-lg tracking-tight">Partners</span>
        </div>

        {/* Tier progress */}
        <div className="px-4 py-3 mx-3 mt-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-xs font-medium text-blue-800">Current Tier</p>
          <p className="text-sm font-bold text-blue-900 mt-0.5">{tierName}</p>
          <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${tierProgress}%` }} />
          </div>
          <p className="text-[11px] text-blue-600 mt-1">
            {tierProgress >= 100 ? 'Top tier reached' : `${tierProgress}% to ${tierNext} tier`}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 mt-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-100 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-xs text-slate-500 truncate">Partner Account</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {children}
      </main>
    </div>
  )
}
