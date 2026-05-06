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
  CreditCardIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_COPY = {
  en: {
    brand: 'TrustCore',
    sections: [
      {
        title: 'Overview',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
        ],
      },
      {
        title: 'Privacy Operations',
        items: [
          { name: 'Compliance Status', href: '/compliance', icon: ShieldCheckIcon },
          { name: 'Data Inventory', href: '/data-inventory', icon: CircleStackIcon },
          { name: 'PIAs', href: '/pia', icon: DocumentMagnifyingGlassIcon },
          { name: 'Incidents', href: '/incidents', icon: ExclamationTriangleIcon },
          { name: 'Requests', href: '/requests', icon: InboxArrowDownIcon },
          { name: 'Vendors', href: '/vendors', icon: BuildingStorefrontIcon },
        ],
      },
      {
        title: 'Governance',
        items: [
          { name: 'Policies', href: '/policies', icon: DocumentTextIcon },
          { name: 'Evidence Vault', href: '/evidence', icon: ArchiveBoxIcon },
        ],
      },
      {
        title: 'Account & Billing',
        items: [
          { name: 'Billing & Plan', href: '/billing', icon: CreditCardIcon },
          { name: 'Profile & Settings', href: '/account', icon: UserCircleIcon },
        ],
      },
    ] as NavSection[],
  },
  fr: {
    brand: 'TrustCore',
    sections: [
      {
        title: 'Vue d\'ensemble',
        items: [
          { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon },
        ],
      },
      {
        title: 'Operations de confidentialite',
        items: [
          { name: 'Etat de conformite', href: '/compliance', icon: ShieldCheckIcon },
          { name: 'Inventaire des donnees', href: '/data-inventory', icon: CircleStackIcon },
          { name: 'EFVP', href: '/pia', icon: DocumentMagnifyingGlassIcon },
          { name: 'Incidents', href: '/incidents', icon: ExclamationTriangleIcon },
          { name: 'Demandes', href: '/requests', icon: InboxArrowDownIcon },
          { name: 'Fournisseurs', href: '/vendors', icon: BuildingStorefrontIcon },
        ],
      },
      {
        title: 'Gouvernance',
        items: [
          { name: 'Politiques', href: '/policies', icon: DocumentTextIcon },
          { name: 'Coffre de preuves', href: '/evidence', icon: ArchiveBoxIcon },
        ],
      },
      {
        title: 'Compte et facturation',
        items: [
          { name: 'Forfait et facturation', href: '/billing', icon: CreditCardIcon },
          { name: 'Profil et parametres', href: '/account', icon: UserCircleIcon },
        ],
      },
    ] as NavSection[],
  },
} as const

export function TrustCoreSidebar({ lang }: { lang: 'en' | 'fr' }) {
  const pathname = usePathname()
  const copy = NAV_COPY[lang]

  return (
    <aside className="hidden md:flex w-64 border-r border-gray-200 bg-white flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ShieldCheckIcon className="h-6 w-6 text-teal-600" />
          <span className="text-lg font-bold text-gray-900">{copy.brand}</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {copy.sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
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
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
