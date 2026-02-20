/**
 * @nzila/os-core — RBAC Roles
 *
 * Defines canonical roles across the Nzila platform.
 * Apps must NOT define their own ad-hoc role enums — use these.
 */

// ── Console roles ─────────────────────────────────────────────────────────

export const ConsoleRole = {
  SUPER_ADMIN: 'console:super_admin',
  ADMIN: 'console:admin',
  FINANCE_ADMIN: 'console:finance_admin',
  FINANCE_VIEWER: 'console:finance_viewer',
  ML_ENGINEER: 'console:ml_engineer',
  COMPLIANCE_OFFICER: 'console:compliance_officer',
  DEVELOPER: 'console:developer',
  VIEWER: 'console:viewer',
} as const

export type ConsoleRole = (typeof ConsoleRole)[keyof typeof ConsoleRole]

// ── Partners portal roles ─────────────────────────────────────────────────

export const PartnerRole = {
  CHANNEL_ADMIN: 'partner:channel_admin',
  CHANNEL_SALES: 'partner:channel_sales',
  CHANNEL_EXECUTIVE: 'partner:channel_executive',
  ISV_ADMIN: 'partner:isv_admin',
  ISV_TECHNICAL: 'partner:isv_technical',
  ENTERPRISE_ADMIN: 'partner:enterprise_admin',
  ENTERPRISE_USER: 'partner:enterprise_user',
} as const

export type PartnerRole = (typeof PartnerRole)[keyof typeof PartnerRole]

// ── Union-Eyes roles ──────────────────────────────────────────────────────

export const UERole = {
  CASE_MANAGER: 'ue:case_manager',
  SUPERVISOR: 'ue:supervisor',
  ANALYST: 'ue:analyst',
  VIEWER: 'ue:viewer',
} as const

export type UERole = (typeof UERole)[keyof typeof UERole]

// ── System roles (background jobs, webhooks) ───────────────────────────────

export const SystemRole = {
  WEBHOOK_PROCESSOR: 'system:webhook_processor',
  CRON_JOB: 'system:cron_job',
  MIGRATION: 'system:migration',
} as const

export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole]

// ── Union type ────────────────────────────────────────────────────────────

export type NzilaRole = ConsoleRole | PartnerRole | UERole | SystemRole

// ── Role hierarchy (what each role inherits) ─────────────────────────────

export const ROLE_HIERARCHY: Record<NzilaRole, NzilaRole[]> = {
  [ConsoleRole.SUPER_ADMIN]: [
    ConsoleRole.ADMIN,
    ConsoleRole.FINANCE_ADMIN,
    ConsoleRole.ML_ENGINEER,
    ConsoleRole.COMPLIANCE_OFFICER,
    ConsoleRole.DEVELOPER,
    ConsoleRole.VIEWER,
  ],
  [ConsoleRole.ADMIN]: [
    ConsoleRole.FINANCE_ADMIN,
    ConsoleRole.ML_ENGINEER,
    ConsoleRole.DEVELOPER,
    ConsoleRole.VIEWER,
  ],
  [ConsoleRole.FINANCE_ADMIN]: [ConsoleRole.FINANCE_VIEWER],
  [ConsoleRole.FINANCE_VIEWER]: [],
  [ConsoleRole.ML_ENGINEER]: [ConsoleRole.VIEWER],
  [ConsoleRole.COMPLIANCE_OFFICER]: [ConsoleRole.VIEWER],
  [ConsoleRole.DEVELOPER]: [ConsoleRole.VIEWER],
  [ConsoleRole.VIEWER]: [],
  [PartnerRole.CHANNEL_ADMIN]: [PartnerRole.CHANNEL_SALES, PartnerRole.CHANNEL_EXECUTIVE],
  [PartnerRole.CHANNEL_SALES]: [],
  [PartnerRole.CHANNEL_EXECUTIVE]: [],
  [PartnerRole.ISV_ADMIN]: [PartnerRole.ISV_TECHNICAL],
  [PartnerRole.ISV_TECHNICAL]: [],
  [PartnerRole.ENTERPRISE_ADMIN]: [PartnerRole.ENTERPRISE_USER],
  [PartnerRole.ENTERPRISE_USER]: [],
  [UERole.SUPERVISOR]: [UERole.CASE_MANAGER, UERole.ANALYST, UERole.VIEWER],
  [UERole.CASE_MANAGER]: [UERole.VIEWER],
  [UERole.ANALYST]: [UERole.VIEWER],
  [UERole.VIEWER]: [],
  [SystemRole.WEBHOOK_PROCESSOR]: [],
  [SystemRole.CRON_JOB]: [],
  [SystemRole.MIGRATION]: [],
}

/** Returns true if `role` has the `required` role (directly or via hierarchy). */
export function roleIncludes(role: NzilaRole, required: NzilaRole): boolean {
  if (role === required) return true
  const inherited = ROLE_HIERARCHY[role] ?? []
  return inherited.includes(required) || inherited.some((r) => roleIncludes(r, required))
}
