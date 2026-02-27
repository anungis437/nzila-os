import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  PuzzlePieceIcon,
  Cog6ToothIcon,
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ServerIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { ExecutiveModeWrapper } from './executive-mode'

const navItems = [
  { name: 'Dashboard', href: '/console', icon: HomeIcon },
  { name: 'Platform', href: '/platform', icon: GlobeAltIcon },
  { name: 'Business OS', href: '/business', icon: BuildingOffice2Icon },
  { name: 'Audit Insights', href: '/audit-insights', icon: ShieldCheckIcon },
  { name: 'System Health', href: '/system-health', icon: ServerIcon },
  { name: 'Governance', href: '/governance', icon: EyeIcon },
  { name: 'Docs', href: '/docs', icon: DocumentTextIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Automation', href: '/automation', icon: CogIcon },
  { name: 'Standards', href: '/standards', icon: BookOpenIcon },
  { name: 'Integrations', href: '/settings/integrations', icon: PuzzlePieceIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

// External app URLs — configurable via NEXT_PUBLIC_* env vars
const appLinks = [
  { name: 'Public Web', href: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000', badge: '3000' },
  { name: 'Partner Portal', href: process.env.NEXT_PUBLIC_PARTNERS_URL ?? 'http://localhost:3002', badge: '3002' },
  { name: 'Union Eyes', href: process.env.NEXT_PUBLIC_UNION_EYES_URL ?? 'http://localhost:3003', badge: '3003' },
  { name: 'ABR Insights', href: process.env.NEXT_PUBLIC_ABR_URL ?? 'http://localhost:3004', badge: '3004' },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const sidebar = (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <Link href="/console" className="text-xl font-bold text-blue-600">
          Nzila Console
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* App Launcher */}
      <div className="px-3 pb-2 border-t border-gray-100 pt-3">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Launch App</p>
        {appLinks.map((app) => (
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
        ))}
      </div>
      <div className="p-4 border-t border-gray-100 flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
        <span className="text-sm text-gray-500">Account</span>
      </div>
    </aside>
  )

  return (
    <ExecutiveModeWrapper sidebar={sidebar}>
      {children}
    </ExecutiveModeWrapper>
  )
}
