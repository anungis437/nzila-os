'use client'

/**
 * Console workspace sub-tab bar.
 *
 * Link-based, `?tab=` driven so the surface stays server-rendered and
 * deep-linkable. Active state from the current `tab` search param.
 */
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { SubTab } from '../_lib/nav'

export function SubTabs({
  tabs,
  activeTab,
}: {
  tabs: SubTab[]
  /** Resolved active tab (already defaulted server-side). */
  activeTab: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (tabs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-px">
      {tabs.map((t) => {
        const active = t.key === activeTab
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', t.key)
        return (
          <Link
            key={t.key}
            href={`${pathname}?${params.toString()}`}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
