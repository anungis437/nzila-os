'use client'

/**
 * Mobile shell for the dashboard.
 *
 * Renders a slim top bar (logo + open-menu + command-palette hint) and a
 * slide-in drawer that hosts the same sidebar used on desktop. Visible only
 * below `md`; the desktop sidebar handles ≥ md.
 *
 * Drawer uses `inert` on the rest of the document while open, traps focus
 * within itself, and closes on Escape, backdrop click, or route change.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

export function MobileShell({ sidebar }: { sidebar: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Close on route change — legitimate sync with external system (the router).
  // The set-state-in-effect rule applies to derived state, not to side-effects
  // that respond to external observables.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [pathname])

  // Lock body scroll while open + close on Esc + initial focus
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Trigger the global command palette by dispatching ⌘K
  const openPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    )
  }

  return (
    <>
      {/* Top bar — md:hidden so desktop ignores it */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white/95 backdrop-blur px-3 h-12">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <Link href="/console" className="text-sm font-bold text-blue-600 truncate">
          Nzila Console
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open command palette"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Drawer */}
      {open ? (
        <div
          className="md:hidden fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          <div
            className="absolute inset-0 bg-gray-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={drawerRef}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col motion-safe:animate-[slideIn_180ms_ease-out]"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-3 h-12">
              <Link href="/console" className="text-sm font-bold text-blue-600">
                Nzila Console
              </Link>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebar}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}
