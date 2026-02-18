import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  HomeIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'

const navItems = [
  { name: 'Dashboard', href: '/console', icon: HomeIcon },
  { name: 'Business OS', href: '/business', icon: BuildingOffice2Icon },
  { name: 'Docs', href: '/docs', icon: DocumentTextIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Automation', href: '/automation', icon: CogIcon },
  { name: 'Standards', href: '/standards', icon: BookOpenIcon },
]

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
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
        <div className="p-4 border-t border-gray-100 flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <span className="text-sm text-gray-500">Account</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
