/**
 * @nzila/trustcore-core — RBAC Permissions Map
 *
 * Defines the permission keys and per-role grants for the TrustCore
 * privacy compliance platform. Roles mirror the entries added to
 * `@nzila/platform-contracts` platformRoleValues.
 *
 * Design rules:
 *  1. Higher-privilege roles implicitly inherit all lower-privilege permissions.
 *     Callers should use `hasPermission(role, permission)` — not raw map lookup.
 *  2. `platform_admin` and `app_owner` (via platform-contracts hierarchy) bypass
 *     all TrustCore permission checks; enforce this at the guard layer, not here.
 *  3. This module is pure (no IO, no DB). Suitable for both server and client use.
 */

// ── Permission keys ────────────────────────────────────────────────────────

export const TRUSTCORE_PERMISSIONS = [
  // Data visibility
  'view_dashboard',
  'view_compliance',
  'view_evidence',
  'view_audit_trail',
  // Data assets & inventory
  'read_data_assets',
  'write_data_assets',
  // Privacy Impact Assessments
  'read_pias',
  'write_pias',
  'approve_pias',
  // Incidents
  'read_incidents',
  'write_incidents',
  // DSR (Data Subject Requests)
  'read_dsr_requests',
  'write_dsr_requests',
  // Consent records
  'read_consent_records',
  'write_consent_records',
  // Vendor register
  'read_vendors',
  'write_vendors',
  // Risk register
  'read_risks',
  'write_risks',
  'review_risks',
  // Reminders
  'read_reminders',
  'manage_reminders',
  // Privacy program management
  'manage_privacy_program',
  // Export
  'export_compliance_report',
  'export_evidence',
  // Billing
  'manage_billing',
  // Admin / platform operations
  'manage_leads',
] as const

export type TrustcorePermission = (typeof TRUSTCORE_PERMISSIONS)[number]

// ── TrustCore role values (subset of PlatformRole) ─────────────────────────

export const TRUSTCORE_ROLES = [
  'platform_admin',
  'org_admin',
  'privacy_officer',
  'security_officer',
  'compliance_officer',
  'legal_reviewer',
  'auditor',
  'external_auditor',
  'org_member',
  'read_only',
] as const

export type TrustcoreRole = (typeof TRUSTCORE_ROLES)[number]

// ── Role → Permission grants ───────────────────────────────────────────────

const ROLE_GRANTS: Record<TrustcoreRole, readonly TrustcorePermission[]> = {
  platform_admin: [...TRUSTCORE_PERMISSIONS],

  org_admin: [
    'view_dashboard',
    'view_compliance',
    'view_evidence',
    'view_audit_trail',
    'read_data_assets',
    'write_data_assets',
    'read_pias',
    'write_pias',
    'approve_pias',
    'read_incidents',
    'write_incidents',
    'read_dsr_requests',
    'write_dsr_requests',
    'read_consent_records',
    'write_consent_records',
    'read_vendors',
    'write_vendors',
    'read_risks',
    'write_risks',
    'review_risks',
    'read_reminders',
    'manage_reminders',
    'manage_privacy_program',
    'export_compliance_report',
    'export_evidence',
    'manage_billing',
  ],

  privacy_officer: [
    'view_dashboard',
    'view_compliance',
    'view_evidence',
    'view_audit_trail',
    'read_data_assets',
    'write_data_assets',
    'read_pias',
    'write_pias',
    'approve_pias',
    'read_incidents',
    'write_incidents',
    'read_dsr_requests',
    'write_dsr_requests',
    'read_consent_records',
    'write_consent_records',
    'read_vendors',
    'write_vendors',
    'read_risks',
    'write_risks',
    'review_risks',
    'read_reminders',
    'manage_reminders',
    'manage_privacy_program',
    'export_compliance_report',
    'export_evidence',
  ],

  security_officer: [
    'view_dashboard',
    'view_compliance',
    'view_evidence',
    'read_data_assets',
    'read_pias',
    'write_pias',
    'read_incidents',
    'write_incidents',
    'read_vendors',
    'write_vendors',
    'read_risks',
    'write_risks',
    'review_risks',
    'read_reminders',
    'export_compliance_report',
  ],

  compliance_officer: [
    'view_dashboard',
    'view_compliance',
    'view_evidence',
    'read_data_assets',
    'write_data_assets',
    'read_pias',
    'write_pias',
    'read_incidents',
    'write_incidents',
    'read_dsr_requests',
    'write_dsr_requests',
    'read_consent_records',
    'write_consent_records',
    'read_vendors',
    'read_risks',
    'write_risks',
    'review_risks',
    'read_reminders',
    'manage_reminders',
    'export_compliance_report',
  ],

  legal_reviewer: [
    'view_dashboard',
    'view_compliance',
    'read_data_assets',
    'read_pias',
    'read_incidents',
    'read_dsr_requests',
    'read_consent_records',
    'read_vendors',
    'read_risks',
    'read_reminders',
    'export_compliance_report',
  ],

  auditor: [
    'view_dashboard',
    'view_compliance',
    'view_evidence',
    'view_audit_trail',
    'read_data_assets',
    'read_pias',
    'read_incidents',
    'read_dsr_requests',
    'read_consent_records',
    'read_vendors',
    'read_risks',
    'read_reminders',
    'export_compliance_report',
    'export_evidence',
  ],

  external_auditor: [
    'view_compliance',
    'view_evidence',
    'read_pias',
    'read_risks',
    'export_compliance_report',
  ],

  org_member: [
    'view_dashboard',
    'view_compliance',
    'read_data_assets',
    'read_pias',
    'read_incidents',
    'read_dsr_requests',
    'read_vendors',
    'read_risks',
    'read_reminders',
  ],

  read_only: [
    'view_dashboard',
    'view_compliance',
  ],
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Return the full set of permissions granted to `role`.
 * Returns an empty array for unrecognised roles.
 */
export function getPermissionsForRole(role: string): readonly TrustcorePermission[] {
  return ROLE_GRANTS[role as TrustcoreRole] ?? []
}

/**
 * Return true when `role` is granted `permission`.
 *
 * @example
 *   if (!hasPermission(ctx.role, 'write_risks')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 */
export function hasPermission(role: string, permission: TrustcorePermission): boolean {
  return getPermissionsForRole(role).includes(permission)
}
