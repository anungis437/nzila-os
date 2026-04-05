'use client'

/**
 * @nzila/platform-auth — UserButton Component
 *
 * Drop-in replacement for Clerk's `<UserButton />`.
 * Renders avatar + dropdown with sign-out option.
 */
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'

export interface UserButtonProps {
  /** URL to redirect after sign out. Default: '/' */
  afterSignOutUrl?: string
  /** Additional CSS class for the root element. */
  className?: string
  /** Show user name next to avatar. */
  showName?: boolean
  /** Clerk-compat: appearance config (ignored — styling handled by Tailwind). */
  appearance?: Record<string, unknown>
}

/**
 * User avatar button with sign-out dropdown.
 * Replaces `<UserButton />` from `@clerk/nextjs`.
 */
export function UserButton({
  afterSignOutUrl = '/',
  className = '',
  showName = false,
}: UserButtonProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session?.user) return null

  const initials = (session.user.name ?? session.user.email ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('')

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="User menu"
        aria-expanded={open}
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? 'User avatar'}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {initials}
          </div>
        )}
        {showName && session.user.name && (
          <span className="text-sm font-medium">{session.user.name}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {session.user.email}
            </p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => signOut({ redirectTo: afterSignOutUrl })}
              className="flex w-full items-center rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
