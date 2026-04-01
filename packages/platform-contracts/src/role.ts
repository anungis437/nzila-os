/**
 * @nzila/platform-contracts — Role & Permission Contracts
 *
 * Platform-level RBAC primitives. Domain verticals extend
 * with domain-specific roles/permissions via template unions.
 */
import { z } from 'zod'

// ── Platform Roles ──────────────────────────────────────────────────────────

export const platformRoleValues = [
  'app_owner',
  'platform_admin',
  'org_admin',
  'org_member',
  'org_viewer',
  'service_account',
] as const

export type PlatformRole = (typeof platformRoleValues)[number]

// ── Role Definition ─────────────────────────────────────────────────────────

export const roleDefinitionSchema = z.object({
  /** Unique role identifier. */
  id: z.string().min(1),
  /** Human-readable name. */
  name: z.string().min(1),
  /** Description. */
  description: z.string().optional(),
  /** Permission keys granted by this role. */
  permissions: z.array(z.string()),
  /** Whether this is a platform-level role (vs. org-level). */
  isPlatformRole: z.boolean().default(false),
  /** Hierarchy level (higher = more privileged). */
  level: z.number().int().nonnegative(),
})

export type RoleDefinition = z.infer<typeof roleDefinitionSchema>

// ── Permission Check Request ────────────────────────────────────────────────

export const permissionCheckSchema = z.object({
  /** User ID. */
  userId: z.string().min(1),
  /** Org scope. */
  orgId: z.string().min(1),
  /** Required permission key. */
  permission: z.string().min(1),
  /** Optional resource identifier for resource-level checks. */
  resourceId: z.string().optional(),
})

export type PermissionCheck = z.infer<typeof permissionCheckSchema>

// ── Permission Check Result ─────────────────────────────────────────────────

export const permissionResultSchema = z.object({
  granted: z.boolean(),
  role: z.string().optional(),
  reason: z.string().optional(),
})

export type PermissionResult = z.infer<typeof permissionResultSchema>

// ── Role Hierarchy Helper ───────────────────────────────────────────────────

const roleHierarchy: Record<PlatformRole, number> = {
  app_owner: 100,
  platform_admin: 90,
  org_admin: 70,
  org_member: 50,
  org_viewer: 30,
  service_account: 80,
}

/** Check if `userRole` meets or exceeds `requiredRole` in hierarchy. */
export function meetsRoleRequirement(
  userRole: PlatformRole,
  requiredRole: PlatformRole,
): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0)
}
