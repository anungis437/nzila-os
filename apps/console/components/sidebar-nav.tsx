'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  BoltIcon,
  LockClosedIcon,
  FingerPrintIcon,
  ArrowTrendingUpIcon,
  CloudIcon,
  CurrencyDollarIcon,
  LinkIcon,
  ChartBarSquareIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  DocumentArrowDownIcon,
  CpuChipIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  CommandLineIcon,
  CalendarDaysIcon,
  SparklesIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
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
  BoltIcon,
  LockClosedIcon,
  FingerPrintIcon,
  ArrowTrendingUpIcon,
  CloudIcon,
  CurrencyDollarIcon,
  LinkIcon,
  ChartBarSquareIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  DocumentArrowDownIcon,
  CpuChipIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  CircleStackIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  CommandLineIcon,
  CalendarDaysIcon,
  SparklesIcon,
  CheckCircleIcon,
  ClockIcon,
}

export interface NavItem {
  name: string
  href: string
  icon: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
  defaultOpen?: boolean
}

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {groups.map((group) => (
        <NavSection
          key={group.label}
          group={group}
          pathname={pathname}
        />
      ))}
    </nav>
  )
}

function NavSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const hasActiveChild = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
  )
  const [open, setOpen] = useState(group.defaultOpen ?? hasActiveChild)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition"
      >
        {group.label}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = iconMap[item.icon]
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                {item.name}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
