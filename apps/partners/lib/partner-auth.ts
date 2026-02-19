/**
 * Partner auth helpers — role & org utilities on top of Clerk.
 *
 * Partner roles follow the pattern: `{partnerType}:{role}`
 *   - channel:admin, channel:sales, channel:executive
 *   - isv:admin, isv:technical, isv:business
 *   - enterprise:admin, enterprise:user
 */
import { auth } from '@clerk/nextjs/server'

export type PartnerType = 'channel' | 'isv' | 'enterprise'

export type PartnerRole =
  | 'channel:admin' | 'channel:sales' | 'channel:executive'
  | 'isv:admin' | 'isv:technical' | 'isv:business'
  | 'enterprise:admin' | 'enterprise:user'

/**
 * Extract the partner type and sub-role from a Clerk custom role string.
 */
export function parsePartnerRole(role: string): { type: PartnerType; sub: string } | null {
  const parts = role.split(':')
  if (parts.length !== 2) return null
  const [type, sub] = parts
  if (!['channel', 'isv', 'enterprise'].includes(type!)) return null
  return { type: type as PartnerType, sub: sub! }
}

/**
 * Returns the current user's Clerk session claims.
 * Throws redirect to /sign-in if unauthenticated.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session.userId) {
    throw new Error('Unauthenticated')
  }
  return session
}

/**
 * Check whether the current user has a specific role.
 */
export async function hasRole(role: PartnerRole): Promise<boolean> {
  const session = await auth()
  if (!session.userId) return false
  const result = await session.has({ role })
  return result
}

/**
 * Check whether the current user has ANY of the given roles.
 */
export async function hasAnyRole(roles: PartnerRole[]): Promise<boolean> {
  for (const role of roles) {
    if (await hasRole(role)) return true
  }
  return false
}
