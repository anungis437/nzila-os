'use client'

/**
 * Console workspace top tab bar — the six-workspace surface + Settings.
 *
 * Club360-style horizontal tabs. Active state derived from the pathname so it
 * stays correct across deep links and server navigation.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ArrowTrendingUpIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { WORKSPACES } from '../_lib/nav'

const ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  HomeIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  ArrowTrendingUpIcon,
  RocketLaunchIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
}

export function WorkspaceTabs() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="-mx-3 flex h-15.25 gap-1 overflow-x-auto">
          {WORKSPACES.map((w) => {
            const active = pathname === w.href || pathname.startsWith(w.href + '/')
            const Icon = ICONS[w.icon]
            return (
              <Link
                key={w.key}
                href={w.href}
                className={`flex h-full shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                {w.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
