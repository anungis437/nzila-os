'use client'

import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

export function HelpTooltip({
  label,
  content,
  side = 'top',
}: {
  label: string
  content: string
  side?: 'top' | 'right'
}) {
  const positionClass = side === 'right'
    ? 'left-full top-1/2 ml-2 -translate-y-1/2'
    : 'bottom-full left-1/2 mb-2 -translate-x-1/2'

  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-64 rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${positionClass}`}
      >
        {content}
      </span>
    </span>
  )
}