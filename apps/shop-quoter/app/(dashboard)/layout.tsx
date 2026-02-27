import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import {
  HomeIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  CogIcon,
  ArrowTopRightOnSquareIcon,
  TruckIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Quotes', href: '/quotes', icon: DocumentTextIcon },
  { name: 'Clients', href: '/clients', icon: UserGroupIcon },
  { name: 'Orders', href: '/orders', icon: ShoppingCartIcon },
  { name: 'Invoices', href: '/invoices', icon: BanknotesIcon },
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Suppliers', href: '/suppliers', icon: TruckIcon },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: ClipboardDocumentListIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Legacy Import', href: '/import', icon: ArrowDownTrayIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

const externalLinks = [
  { name: 'Console', href: process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001', badge: '3001' },
  { name: 'Public Web', href: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000', badge: '3000' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-bold text-purple-600">
            Shop Quoter
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">NzilaOS Commerce</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition"
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* External Links */}
        <div className="px-3 pb-2 border-t border-gray-100 pt-3">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Other Apps
          </p>
          {externalLinks.map((app) => (
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
