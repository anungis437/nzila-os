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
  // ── ITSM roles ──────────────────────────────────────────────────────────────
  /** Frontline support technician — can triage, update, and resolve tickets */
  'itsm_agent',
  /** Team lead / supervisor — can assign, escalate, approve, manage queues */
  'itsm_manager',
  /** Designated CAB / change approver — can approve or reject change requests */
  'itsm_change_approver',
  /** Read-only portal access for MSP client users */
  'itsm_client_viewer',
  // ── TrustCore roles ──────────────────────────────────────────────────────────
  /** Owns the Law 25 program; full create/update on all compliance records */
  'privacy_officer',
  /** Can create/update security incidents and risk register entries */
  'security_officer',
  /** Manages PIAs, DSR requests, consent records, and risk reviews */
  'compliance_officer',
  /** Read + comment access for in-house legal review of PIAs and policies */
  'legal_reviewer',
  /** Internal auditor — full read on all org evidence and snapshots */
  'auditor',
  /** External auditor — scoped read-only access granted per engagement */
  'external_auditor',
  /** Baseline read-only consumer — no create/update permissions */
  'read_only',
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
  itsm_agent: 45,
  itsm_manager: 65,
  itsm_change_approver: 55,
  itsm_client_viewer: 20,
  // ── TrustCore roles ────────────────────────────────────────────────────────
  privacy_officer: 48,
  security_officer: 47,
  compliance_officer: 46,
  legal_reviewer: 35,
  auditor: 32,
  external_auditor: 22,
  read_only: 10,
}

/** Check if `userRole` meets or exceeds `requiredRole` in hierarchy. */
export function meetsRoleRequirement(
  userRole: PlatformRole,
  requiredRole: PlatformRole,
): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0)
}
