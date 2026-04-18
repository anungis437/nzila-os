import { isProductionLikeRuntime, requireEnvVar } from '@/lib/runtime-env'

const PLATFORM_NAMESPACE = 'platform:zonga'
const PLATFORM_DB_UUID = '00000000-0000-0000-0000-000000000000'

/**
 * Resolve canonical org context for commercial/platform events.
 * In production-like environments, PLATFORM_ORG_ID is mandatory.
 */
export function resolveCommercialOrgId(explicitOrgId?: string): string {
  if (explicitOrgId?.trim()) return explicitOrgId.trim()

  if (isProductionLikeRuntime()) {
    return requireEnvVar('PLATFORM_ORG_ID')
  }

  return PLATFORM_NAMESPACE
}

/**
 * Resolve canonical org context for UUID-backed database writes.
 * In production-like environments PLATFORM_ORG_ID is mandatory.
 */
export function resolveCommercialDbOrgId(explicitOrgId?: string): string {
  if (explicitOrgId?.trim()) return explicitOrgId.trim()

  if (isProductionLikeRuntime()) {
    return requireEnvVar('PLATFORM_ORG_ID')
  }

  return PLATFORM_DB_UUID
}

/**
 * Resolve canonical actor identity for system-generated events.
 */
export function resolveSystemActorId(scope: string): string {
  const cleaned = scope.trim().replace(/[^a-zA-Z0-9:_-]/g, '-')
  return `system:zonga:${cleaned || 'unknown'}`
}
