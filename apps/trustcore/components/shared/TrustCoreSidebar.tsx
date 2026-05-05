'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  InboxArrowDownIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Compliance Status', href: '/compliance', icon: ShieldCheckIcon },
  { name: 'Data Inventory', href: '/data-inventory', icon: CircleStackIcon },
  { name: 'PIAs', href: '/pia', icon: DocumentMagnifyingGlassIcon },
  { name: 'Incidents', href: '/incidents', icon: ExclamationTriangleIcon },
  { name: 'Requests', href: '/requests', icon: InboxArrowDownIcon },
  { name: 'Vendors', href: '/vendors', icon: BuildingStorefrontIcon },
  { name: 'Policies', href: '/policies', icon: DocumentTextIcon },
  { name: 'Evidence Vault', href: '/evidence', icon: ArchiveBoxIcon },
]

export function TrustCoreSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 border-r border-gray-200 bg-white flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-teal-600" />
          <span className="text-lg font-bold text-gray-900">TrustCore</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
