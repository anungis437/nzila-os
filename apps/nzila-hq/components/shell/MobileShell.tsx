'use client'

/**
 * Mobile shell — slide-in drawer wrapping the existing Sidebar on small
 * viewports. The desktop Sidebar remains rendered server-side at md+.
 *
 * - Sticky top bar visible only on `md:hidden`.
 * - Drawer locks body scroll while open.
 * - Auto-closes on route change.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { HqRole } from '@nzila/hq-domain'
import { Sidebar } from './Sidebar'

export function MobileShell({ role }: { role: HqRole }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close the drawer on route change — pathname is the external state
  // we're synchronizing with.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync drawer to route
    setOpen(false)
  }, [pathname])

  // Body scroll lock.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Nzila
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">HQ</span>
        </Link>
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-white shadow-xl">
            <Sidebar role={role} />
          </div>
        </div>
      )}
    </>
  )
}
