'use client'

/**
 * @nzila/platform-auth — Onboarding Guard
 *
 * Redirects authenticated users who have no organization membership
 * to an onboarding page. Use this in app layouts to catch first-time
 * external users who sign in but aren't yet part of an organization.
 *
 * Usage:
 *   import { OnboardingGuard } from '@nzila/platform-auth/entra/components/onboarding-guard'
 *
 *   // In layout.tsx:
 *   <OnboardingGuard onboardingPath="/onboarding">
 *     {children}
 *   </OnboardingGuard>
 */
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import type { EntraSession } from '../types'

export interface OnboardingGuardProps {
  children: ReactNode
  /** Path to redirect orgless users to. Default: '/onboarding' */
  onboardingPath?: string
  /** Paths that skip the guard (e.g., settings, profile). */
  skipPaths?: string[]
}

/**
 * Guard component that redirects users without an org to onboarding.
 * Renders children normally for users with an active organization.
 */
export function OnboardingGuard({
  children,
  onboardingPath = '/onboarding',
  skipPaths = [],
}: OnboardingGuardProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const entra = session as EntraSession | null

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!entra) return

    // Skip if already on onboarding or allowed paths
    if (pathname.startsWith(onboardingPath)) return
    if (skipPaths.some(p => pathname.startsWith(p))) return
    // Skip public paths
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return
    if (pathname.startsWith('/api/')) return

    // Redirect if user has no organization
    if (!entra.activeOrgId) {
      router.replace(onboardingPath)
    }
  }, [status, entra, pathname, onboardingPath, skipPaths, router])

  return <>{children}</>
}
