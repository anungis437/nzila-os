'use client'

import Link from 'next/link'

export default function SupportWidgetShell() {
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-navy-light transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        Artist / Label support
      </Link>
    </div>
  )
}
