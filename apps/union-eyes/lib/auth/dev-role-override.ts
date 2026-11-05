import { isDeployedRuntime, type EnvironmentSource } from '@/lib/runtime/production-guard'
import { UserRole } from './roles'

/**
 * DEV ONLY: DEV_ROLE_OVERRIDE forces any role for local testing (DEV_ROLE_OVERRIDE=steward in .env.local simulates that role).
 *
 * Honoured only when NODE_ENV is 'development' AND nothing identifies the process as a deployed environment: a production container labelled `development`
 * does not open it, and neither does a staging, pilot or demo deployment (lib/runtime/production-guard.ts). A value that is not a role is ignored.
 */
export function devRoleOverride(env: EnvironmentSource = process.env): UserRole | null {
  if (env.NODE_ENV !== 'development' || isDeployedRuntime(env)) return null
  const override = env.DEV_ROLE_OVERRIDE as UserRole | undefined
  if (!override) return null
  return Object.values(UserRole).includes(override) ? override : null
}
