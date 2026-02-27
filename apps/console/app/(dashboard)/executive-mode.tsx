/**
 * Nzila OS — Executive Mode Detector
 *
 * Client component that reads ?mode=executive from URL
 * and conditionally hides sidebar navigation for boardroom view.
 *
 * Purely presentational — no elevated permissions from UI change.
 */
'use client'

import { useSearchParams } from 'next/navigation'

export function useExecutiveMode(): boolean {
  const searchParams = useSearchParams()
  return searchParams.get('mode') === 'executive'
}

export function ExecutiveModeWrapper({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const isExecutive = useExecutiveMode()

  if (isExecutive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 py-2 bg-blue-900 text-white text-center text-sm font-medium">
          Executive View — Read Only
        </div>
        <main className="overflow-y-auto">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {sidebar}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
