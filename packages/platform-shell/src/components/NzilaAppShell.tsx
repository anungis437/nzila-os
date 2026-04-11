'use client'

import { type ReactNode, useMemo } from 'react'
import { useAuth, useUser, useOrganization } from '@nzila/platform-auth/entra/client'
import { ShellProvider } from '../context/provider.js'
import { ShellLayout } from './ShellLayout.js'
import { ModuleRegistry } from '../registry/registry.js'
import { DEFAULT_MODULES } from '../registry/default-modules.js'
import type { ShellUser, ShellOrg } from '../context/types.js'
import type { PlatformRole } from '@nzila/platform-contracts/role'

export interface NzilaAppShellProps {
  children: ReactNode
  /** Module identifier matching DEFAULT_MODULES (e.g. 'union-eyes', 'flow'). */
  moduleId: string
  /** Hide shell chrome (nav/sidebar). Useful for full-screen views. */
  hideNav?: boolean
  /** Module-specific sidebar content. */
  moduleSidebar?: ReactNode
}

/**
 * Unified app shell — bridges platform-auth into platform-shell.
 *
 * Usage in any governed app layout:
 * ```tsx
 * <AuthProvider>
 *   <NzilaAppShell moduleId="union-eyes">
 *     {children}
 *   </NzilaAppShell>
 * </AuthProvider>
 * ```
 */
export function NzilaAppShell({
  children,
  moduleId,
  hideNav,
  moduleSidebar,
}: NzilaAppShellProps) {
  const { isLoaded: authLoaded, isSignedIn, orgId, orgRole, roles } = useAuth()
  const { isLoaded: userLoaded, user: rawUser } = useUser()
  const { isLoaded: orgLoaded, organization, membership } = useOrganization()

  const registry = useMemo(() => {
    const reg = new ModuleRegistry()
    reg.registerAll(DEFAULT_MODULES)
    return reg
  }, [])

  const shellUser: ShellUser | null = useMemo(() => {
    if (!authLoaded || !userLoaded || !isSignedIn || !rawUser) return null
    return {
      id: rawUser.id,
      email: rawUser.primaryEmailAddress?.emailAddress ?? rawUser.emailAddresses?.[0]?.emailAddress ?? '',
      firstName: rawUser.firstName ?? null,
      lastName: rawUser.lastName ?? null,
      imageUrl: rawUser.imageUrl ?? null,
      roles: (roles ?? []) as PlatformRole[],
    }
  }, [authLoaded, userLoaded, isSignedIn, rawUser, roles])

  const availableOrgs: ShellOrg[] = useMemo(() => {
    if (!orgLoaded || !organization) return []
    return [{
      id: organization.id,
      name: organization.name,
      slug: organization.slug || organization.id,
      imageUrl: null,
      role: membership?.role ?? orgRole ?? 'member',
    }]
  }, [orgLoaded, organization, membership, orgRole])

  if (!authLoaded || !userLoaded) {
    return <>{children}</>
  }

  return (
    <ShellProvider
      user={shellUser}
      availableOrgs={availableOrgs}
      initialOrgId={orgId ?? undefined}
      registry={registry}
      activeModuleId={moduleId}
    >
      <ShellLayout hideNav={hideNav} moduleSidebar={moduleSidebar}>
        {children}
      </ShellLayout>
    </ShellProvider>
  )
}
