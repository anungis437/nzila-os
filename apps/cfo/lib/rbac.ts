import { auth, currentUser } from '@nzila/platform-auth/entra/server'

// ── Super-admin override ────────────────────────────────────────────────────

import { isSuperAdmin } from '@nzila/os-core/config/super-admins'

// ── Role definitions ────────────────────────────────────────────────────────

/**
 * Platform-level roles — control access to Nzila platform features.
 * Stored in auth session claims (nzilaRole).
 */
export type PlatformRole =
  | 'platform_admin'   // Nzila platform administrators
  | 'studio_admin'     // Studio-level admin
  | 'ops'              // Operations / DevOps
  | 'analyst'          // Data analyst
  | 'viewer'           // Read-only platform access

/** @deprecated Use PlatformRole instead */
export type NzilaRole = PlatformRole

/**
 * Firm-level roles — control access within an accounting firm.
 * Stored in org_members.firmRole (org metadata).
 */
export type FirmRole =
  | 'firm_owner'          // Managing partner — full control, billing, firm settings
  | 'partner'             // Partner — full client access, approve engagements, manage team
  | 'manager'             // Senior accountant / engagement manager — review, approve, assign
  | 'senior_accountant'   // Senior staff — tax prep, bookkeeping, limited admin
  | 'staff_accountant'    // Junior staff — daily work, no admin access
  | 'bookkeeper'          // Bookkeeping only — GL, bank rec, no tax / advisory
  | 'admin_assistant'     // Office admin — scheduling, docs, no financial access

/**
 * Client-level roles — for external users accessing the client portal.
 */
export type ClientRole =
  | 'client_owner'    // Business owner — sees their data, approves deliverables, signs
  | 'client_contact'  // Secondary contact (e.g., office manager) — view + upload docs
  | 'client_viewer'   // Read-only view of their own reports/documents

/** Union of all firm + client roles (entity-scoped) */
export type EntityRole = FirmRole | ClientRole

/** Every role in the system */
export type AppRole = PlatformRole | FirmRole | ClientRole

// ── Role hierarchy ──────────────────────────────────────────────────────────

/** Firm role hierarchy (higher = more power) */
export const FIRM_ROLE_HIERARCHY: Record<FirmRole, number> = {
  firm_owner: 70,
  partner: 60,
  manager: 50,
  senior_accountant: 40,
  staff_accountant: 30,
  bookkeeper: 20,
  admin_assistant: 10,
}

/** Client role hierarchy */
export const CLIENT_ROLE_HIERARCHY: Record<ClientRole, number> = {
  client_owner: 30,
  client_contact: 20,
  client_viewer: 10,
}

// ── Permissions ─────────────────────────────────────────────────────────────

/**
 * Granular permissions for CFO app features.
 * Each permission maps to a specific capability.
 */
export type Permission =
  // Dashboard & Overview
  | 'dashboard:view'
  // Clients
  | 'clients:view'
  | 'clients:create'
  | 'clients:edit'
  | 'clients:delete'
  | 'clients:assign'
  // Client Portal
  | 'client_portal:view'
  | 'client_portal:upload'
  | 'client_portal:approve'
  // Ledger / GL
  | 'ledger:view'
  | 'ledger:write'
  | 'ledger:approve'
  // Documents
  | 'documents:view'
  | 'documents:upload'
  | 'documents:delete'
  // Tasks / Engagements
  | 'tasks:view'
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:complete'
  // Reports
  | 'reports:view'
  | 'reports:create'
  | 'reports:export'
  // Integrations (QBO, Stripe, etc.)
  | 'integrations:view'
  | 'integrations:manage'
  // Tax Tools
  | 'tax_tools:view'
  | 'tax_tools:calculate'
  // Workflows
  | 'workflows:view'
  | 'workflows:create'
  | 'workflows:manage'
  // Alerts & Notifications
  | 'alerts:view'
  | 'notifications:view'
  | 'notifications:manage'
  // AI / Advisory
  | 'advisory_ai:view'
  | 'advisory_ai:use'
  | 'ai_insights:view'
  // Messages
  | 'messages:view'
  | 'messages:send'
  // Security & Audit
  | 'security:view'
  | 'security:manage'
  | 'audit:view'
  // Settings
  | 'settings:view'
  | 'settings:manage'
  // Platform Admin
  | 'platform_admin:view'
  | 'platform_admin:manage'
  // FX / Multi-Currency
  | 'fx:view'
  | 'fx:convert'

// ── Permission matrix ───────────────────────────────────────────────────────

/**
 * Maps each firm role to its granted permissions.
 * Immutable at runtime — compile-time permission matrix.
 */
export const FIRM_PERMISSIONS: Record<FirmRole, readonly Permission[]> = {
  firm_owner: [
    'dashboard:view',
    'clients:view', 'clients:create', 'clients:edit', 'clients:delete', 'clients:assign',
    'client_portal:view', 'client_portal:upload', 'client_portal:approve',
    'ledger:view', 'ledger:write', 'ledger:approve',
    'documents:view', 'documents:upload', 'documents:delete',
    'tasks:view', 'tasks:create', 'tasks:assign', 'tasks:complete',
    'reports:view', 'reports:create', 'reports:export',
    'integrations:view', 'integrations:manage',
    'tax_tools:view', 'tax_tools:calculate',
    'workflows:view', 'workflows:create', 'workflows:manage',
    'alerts:view',
    'notifications:view', 'notifications:manage',
    'advisory_ai:view', 'advisory_ai:use',
    'ai_insights:view',
    'messages:view', 'messages:send',
    'security:view', 'security:manage',
    'audit:view',
    'settings:view', 'settings:manage',
    'fx:view', 'fx:convert',
  ],
  partner: [
    'dashboard:view',
    'clients:view', 'clients:create', 'clients:edit', 'clients:assign',
    'client_portal:view', 'client_portal:upload', 'client_portal:approve',
    'ledger:view', 'ledger:write', 'ledger:approve',
    'documents:view', 'documents:upload', 'documents:delete',
    'tasks:view', 'tasks:create', 'tasks:assign', 'tasks:complete',
    'reports:view', 'reports:create', 'reports:export',
    'integrations:view', 'integrations:manage',
    'tax_tools:view', 'tax_tools:calculate',
    'workflows:view', 'workflows:create', 'workflows:manage',
    'alerts:view',
    'notifications:view', 'notifications:manage',
    'advisory_ai:view', 'advisory_ai:use',
    'ai_insights:view',
    'messages:view', 'messages:send',
    'security:view',
    'audit:view',
    'settings:view',
    'fx:view', 'fx:convert',
  ],
  manager: [
    'dashboard:view',
    'clients:view', 'clients:create', 'clients:edit', 'clients:assign',
    'client_portal:view', 'client_portal:upload', 'client_portal:approve',
    'ledger:view', 'ledger:write', 'ledger:approve',
    'documents:view', 'documents:upload',
    'tasks:view', 'tasks:create', 'tasks:assign', 'tasks:complete',
    'reports:view', 'reports:create', 'reports:export',
    'integrations:view',
    'tax_tools:view', 'tax_tools:calculate',
    'workflows:view', 'workflows:create', 'workflows:manage',
    'alerts:view',
    'notifications:view',
    'advisory_ai:view', 'advisory_ai:use',
    'ai_insights:view',
    'messages:view', 'messages:send',
    'audit:view',
    'settings:view',
    'fx:view', 'fx:convert',
  ],
  senior_accountant: [
    'dashboard:view',
    'clients:view', 'clients:edit',
    'client_portal:view', 'client_portal:upload',
    'ledger:view', 'ledger:write',
    'documents:view', 'documents:upload',
    'tasks:view', 'tasks:create', 'tasks:complete',
    'reports:view', 'reports:create', 'reports:export',
    'integrations:view',
    'tax_tools:view', 'tax_tools:calculate',
    'workflows:view',
    'alerts:view',
    'notifications:view',
    'advisory_ai:view', 'advisory_ai:use',
    'ai_insights:view',
    'messages:view', 'messages:send',
    'audit:view',
    'fx:view', 'fx:convert',
  ],
  staff_accountant: [
    'dashboard:view',
    'clients:view',
    'client_portal:view',
    'ledger:view', 'ledger:write',
    'documents:view', 'documents:upload',
    'tasks:view', 'tasks:complete',
    'reports:view',
    'tax_tools:view', 'tax_tools:calculate',
    'workflows:view',
    'alerts:view',
    'notifications:view',
    'messages:view', 'messages:send',
    'fx:view',
  ],
  bookkeeper: [
    'dashboard:view',
    'clients:view',
    'ledger:view', 'ledger:write',
    'documents:view', 'documents:upload',
    'tasks:view', 'tasks:complete',
    'reports:view',
    'alerts:view',
    'notifications:view',
    'messages:view',
    'fx:view',
  ],
  admin_assistant: [
    'dashboard:view',
    'clients:view',
    'client_portal:view',
    'documents:view', 'documents:upload',
    'tasks:view',
    'notifications:view',
    'messages:view', 'messages:send',
  ],
} as const

/**
 * Client role permissions — limited to their own data.
 */
export const CLIENT_PERMISSIONS: Record<ClientRole, readonly Permission[]> = {
  client_owner: [
    'dashboard:view',
    'client_portal:view', 'client_portal:upload', 'client_portal:approve',
    'documents:view', 'documents:upload',
    'reports:view',
    'notifications:view',
    'messages:view', 'messages:send',
  ],
  client_contact: [
    'dashboard:view',
    'client_portal:view', 'client_portal:upload',
    'documents:view', 'documents:upload',
    'reports:view',
    'notifications:view',
    'messages:view',
  ],
  client_viewer: [
    'dashboard:view',
    'client_portal:view',
    'documents:view',
    'reports:view',
    'notifications:view',
  ],
} as const

/**
 * Platform role permissions (superset — platform admins bypass firm checks).
 */
export const PLATFORM_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  platform_admin: [
    'platform_admin:view', 'platform_admin:manage',
    'security:view', 'security:manage',
    'settings:view', 'settings:manage',
    'audit:view',
    'dashboard:view',
  ],
  studio_admin: [
    'platform_admin:view',
    'security:view',
    'settings:view', 'settings:manage',
    'audit:view',
    'dashboard:view',
  ],
  ops: [
    'security:view',
    'audit:view',
    'dashboard:view',
    'alerts:view',
  ],
  analyst: [
    'reports:view', 'reports:export',
    'ai_insights:view',
    'dashboard:view',
  ],
  viewer: [
    'dashboard:view',
  ],
} as const

// ── Page-level permission requirements ──────────────────────────────────────

/**
 * Maps each dashboard route to its required permission.
 * Used by the layout for sidebar filtering and by pages for access checks.
 */
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  'dashboard':       'dashboard:view',
  'clients':         'clients:view',
  'client-portal':   'client_portal:view',
  'ledger':          'ledger:view',
  'documents':       'documents:view',
  'tasks':           'tasks:view',
  'reports':         'reports:view',
  'integrations':    'integrations:view',
  'tax-tools':       'tax_tools:view',
  'workflows':       'workflows:view',
  'alerts':          'alerts:view',
  'notifications':   'notifications:view',
  'advisory-ai':     'advisory_ai:view',
  'ai-insights':     'ai_insights:view',
  'messages':        'messages:view',
  'security':        'security:view',
  'audit':           'audit:view',
  'platform-admin':  'platform_admin:view',
  'settings':        'settings:view',
} as const

// ── Permission checking ─────────────────────────────────────────────────────

/**
 * Check whether a given role (firm or client) has a specific permission.
 */
export function roleHasPermission(
  role: FirmRole | ClientRole,
  permission: Permission,
): boolean {
  const perms = (FIRM_PERMISSIONS as Record<string, readonly Permission[]>)[role]
    ?? (CLIENT_PERMISSIONS as Record<string, readonly Permission[]>)[role]
  return perms?.includes(permission) ?? false
}

/**
 * Check whether a platform role has a specific permission.
 */
export function platformRoleHasPermission(
  role: PlatformRole,
  permission: Permission,
): boolean {
  return PLATFORM_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Get all permissions for a given role.
 */
export function getPermissionsForRole(role: AppRole): readonly Permission[] {
  return (FIRM_PERMISSIONS as Record<string, readonly Permission[]>)[role]
    ?? (CLIENT_PERMISSIONS as Record<string, readonly Permission[]>)[role]
    ?? (PLATFORM_PERMISSIONS as Record<string, readonly Permission[]>)[role]
    ?? []
}

/**
 * Get the visible sidebar items for a role.
 * Returns the route keys from PAGE_PERMISSIONS that the role can access.
 */
export function getVisiblePages(role: FirmRole | ClientRole): string[] {
  return Object.entries(PAGE_PERMISSIONS)
    .filter(([, perm]) => roleHasPermission(role, perm))
    .map(([route]) => route)
}

/**
 * Check if a role is a client role (external user).
 */
export function isClientRole(role: string): role is ClientRole {
  return role === 'client_owner' || role === 'client_contact' || role === 'client_viewer'
}

/**
 * Check if a role is a firm role (internal staff).
 */
export function isFirmRole(role: string): role is FirmRole {
  return role in FIRM_ROLE_HIERARCHY
}

// ── Server-side auth helpers ────────────────────────────────────────────────

/**
 * Extract the user's platform role from auth session claims.
 * Falls back to 'viewer' if nothing is set.
 */
export async function getUserRole(): Promise<PlatformRole> {
  const { sessionClaims } = await auth()
  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  const role = meta?.nzilaRole as PlatformRole | undefined
  if (role === 'platform_admin') return 'platform_admin'

  // Super-admin email override
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress
              ?? user?.emailAddresses?.[0]?.emailAddress
  if (isSuperAdmin(email)) {
    return 'platform_admin'
  }

  return role || 'viewer'
}

/**
 * Extract the user's firm/client role from auth org metadata.
 * Falls back to 'staff_accountant' for firm users if unset.
 */
export async function getUserFirmRole(): Promise<FirmRole | ClientRole> {
  const { sessionClaims } = await auth()
  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  const firmRole = meta?.firmRole as FirmRole | ClientRole | undefined
  return firmRole || 'staff_accountant'
}

/**
 * Get both platform and firm roles for the current user.
 */
export async function getUserRoles(): Promise<{
  platformRole: PlatformRole
  firmRole: FirmRole | ClientRole
}> {
  const { sessionClaims } = await auth()
  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  let platformRole = (meta?.nzilaRole as PlatformRole) || 'viewer'

  // Super-admin email override
  if (platformRole !== 'platform_admin') {
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
                ?? user?.emailAddresses?.[0]?.emailAddress
    if (isSuperAdmin(email)) {
      platformRole = 'platform_admin'
    }
  }

  return {
    platformRole,
    firmRole: (meta?.firmRole as FirmRole | ClientRole) || 'staff_accountant',
  }
}

/**
 * Check whether the current user has a specific permission.
 * Checks both firm role and platform role (platform admins bypass).
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const { platformRole, firmRole } = await getUserRoles()
  // Platform admins always have access
  if (platformRole === 'platform_admin') return true
  // Check platform-level permissions
  if (platformRoleHasPermission(platformRole, permission)) return true
  // Check firm/client-level permissions
  return roleHasPermission(firmRole, permission)
}

/**
 * Guard that throws a 403 if the user doesn't have the required permission.
 * Use in server components / route handlers / server actions.
 */
export async function requirePermission(
  permission: Permission,
): Promise<{ platformRole: PlatformRole; firmRole: FirmRole | ClientRole }> {
  const roles = await getUserRoles()
  const allowed = roles.platformRole === 'platform_admin'
    || platformRoleHasPermission(roles.platformRole, permission)
    || roleHasPermission(roles.firmRole, permission)

  if (!allowed) {
    throw new Error(
      `Forbidden: roles "${roles.platformRole}/${roles.firmRole}" lack permission "${permission}"`,
    )
  }
  return roles
}

/**
 * Guard that throws a 403 if the user doesn't have the required platform role.
 * @deprecated Prefer requirePermission() for granular checks.
 */
export async function requireRole(...allowed: PlatformRole[]): Promise<PlatformRole> {
  const role = await getUserRole()
  if (!allowed.includes(role)) {
    throw new Error(`Forbidden: role "${role}" is not in [${allowed.join(', ')}]`)
  }
  return role
}

/**
 * Check role without throwing — returns boolean.
 * @deprecated Prefer hasPermission() for granular checks.
 */
export async function hasRole(...allowed: PlatformRole[]): Promise<boolean> {
  const role = await getUserRole()
  return allowed.includes(role)
}
