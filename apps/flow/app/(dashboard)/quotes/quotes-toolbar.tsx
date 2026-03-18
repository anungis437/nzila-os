'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const TABS = ['All', 'Draft', 'Active', 'Accepted', 'Closed'] as const
type Tab = (typeof TABS)[number]

interface Props {
  counts: { total: number; drafts: number; active: number; won: number }
}

export function QuotesToolbar({ counts }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const currentTab = (searchParams.get('filter') as Tab) ?? 'All'
  const currentSearch = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(currentSearch)

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      startTransition(() => {
        router.push(`${pathname}${qs ? `?${qs}` : ''}`)
      })
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="relative flex-1 max-w-sm w-full">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParams({ q: search })
          }}
          onBlur={() => {
            if (search !== currentSearch) updateParams({ q: search })
          }}
          placeholder="Search by reference, client..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-electric/30 focus:border-electric transition"
        />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => updateParams({ filter: tab === 'All' ? null : tab })}
            className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
              tab === currentTab
                ? 'bg-navy text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
            {tab === 'All' && <span className="ml-1.5 text-white/70">{counts.total}</span>}
            {tab === 'Draft' && counts.drafts > 0 && <span className="ml-1.5 opacity-60">{counts.drafts}</span>}
            {tab === 'Active' && counts.active > 0 && <span className="ml-1.5 opacity-60">{counts.active}</span>}
            {tab === 'Accepted' && counts.won > 0 && <span className="ml-1.5 opacity-60">{counts.won}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
