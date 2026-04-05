'use client'

/**
 * @nzila/platform-auth — OrgSwitcher Component
 *
 * Drop-in replacement for Clerk's `<OrganizationSwitcher />`.
 * Allows users to switch between organizations they belong to.
 */
import { useSession } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'

export interface Organization {
  id: string
  name: string
  slug: string
  imageUrl?: string
}

export interface OrgSwitcherProps {
  /** List of organizations the user belongs to. */
  organizations?: Organization[]
  /** Callback when an org is selected. */
  onOrgChange?: (orgId: string) => void
  /** Additional CSS class. */
  className?: string
  /** Hide personal account option. Default: true */
  hidePersonal?: boolean
  /** Clerk-compat appearance prop (ignored — style via className). */
  appearance?: Record<string, unknown>
  /** Clerk-compat URL after creating an org (ignored). */
  afterCreateOrganizationUrl?: string
  /** Clerk-compat URL after selecting an org (ignored). */
  afterSelectOrganizationUrl?: string
}

/**
 * Organization switcher — replaces `<OrganizationSwitcher />` from `@clerk/nextjs`.
 *
 * Unlike Clerk's version which pulls orgs from Clerk's backend,
 * this expects orgs to be passed as props (fetched from your DB).
 */
export function OrgSwitcher({
  organizations = [],
  onOrgChange,
  className = '',
  hidePersonal = true,
}: OrgSwitcherProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeOrgId = (session as Record<string, unknown> | null)?.activeOrgId as string | undefined

  const activeOrg = organizations.find(o => o.id === activeOrgId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (organizations.length === 0) return null

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        aria-expanded={open}
      >
        {activeOrg ? (
          <>
            <span className="font-medium">{activeOrg.name}</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        ) : (
          <span className="text-gray-500">Select organization</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="p-1">
            {organizations.map(org => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  onOrgChange?.(org.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  org.id === activeOrgId
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {org.imageUrl ? (
                  <img src={org.imageUrl} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium dark:bg-gray-600">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{org.name}</span>
                {org.id === activeOrgId && (
                  <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
