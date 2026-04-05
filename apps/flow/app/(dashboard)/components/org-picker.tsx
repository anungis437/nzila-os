'use client'

import { OrganizationSwitcher, useOrganization } from '@nzila/platform-auth/entra/client'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'

/**
 * Org picker for Flow sidebar — mirrors the UE OrganizationSelector pattern.
 *
 * Uses Clerk's built-in OrganizationSwitcher under the hood, styled to
 * match the Nzila design system (navy/electric palette, compact sidebar fit).
 */
export function OrgPicker() {
  return (
    <div className="px-3 py-2">
      <p className="px-1 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Organization
      </p>
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'w-full',
            organizationSwitcherTrigger:
              'w-full justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors',
            organizationSwitcherTriggerIcon: 'text-gray-400',
            organizationPreviewMainIdentifier: 'text-sm font-medium text-gray-900',
            organizationPreviewSecondaryIdentifier: 'text-xs text-gray-500',
          },
        }}
      />
    </div>
  )
}

/**
 * Inline guard — renders children only when a Clerk org is active.
 * Shows a prompt to select an org otherwise.
 */
export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <BuildingOffice2Icon className="h-12 w-12 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-700">
          Select an Organization
        </h2>
        <p className="text-sm text-gray-500 max-w-md">
          Use the organization picker in the sidebar to select or create an
          organization before using Flow.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
