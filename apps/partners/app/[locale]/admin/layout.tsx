import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, currentUser as _currentUser } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import {
  HomeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { isPlatformAdmin } from '@/lib/partner-auth'

const adminNavItems = [
  { label: 'Dashboard', href: '/admin', icon: HomeIcon },
  { label: 'Partners', href: '/admin/partners', icon: UsersIcon },
  { label: 'Commissions', href: '/admin/commissions', icon: CurrencyDollarIcon },
  { label: 'Analytics', href: '/admin/analytics', icon: ChartBarIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  // Check platform admin access
  const hasAdminAccess = await isPlatformAdmin()
  
  if (!hasAdminAccess) {
    redirect('/portal')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
          <div className="w-7 h-7 bg-blue-600 rounded-lg" />
          <span className="font-bold text-lg tracking-tight text-white">Partner Admin</span>
        </div>

        {/* Platform Admin Badge */}
        <div className="mx-3 mt-4 rounded-xl bg-blue-900/30 border border-blue-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
            <p className="text-xs font-medium text-blue-200">Platform Admin</p>
          </div>
          <p className="text-[11px] text-blue-400/70 mt-1">
            Full platform access
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 mt-4 px-3 space-y-0.5 overflow-y-auto">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Back to Partner Portal */}
        <div className="px-3 py-3 border-t border-slate-800">
          <Link
            href="/portal"
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            ← Back to Partner Portal
          </Link>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-800 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-xs text-slate-400 truncate">Admin Account</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {children}
      </main>
    </div>
  )
}
