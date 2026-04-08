// ─── Authority Model ─────────────────────────────────────────────
// Encodes the union operating principle:
// "A member may submit initial information, but ONLY a rep/LRO
//  may create an official case or grievance work item."

/**
 * Role names aligned with UE ROLE_HIERARCHY in api-auth-guard.ts.
 * We only need the hierarchy level comparison, not the full set.
 */
export type AuthorityRole =
  | 'member'
  | 'health_safety_rep'
  | 'bargaining_committee'
  | 'steward'
  | 'officer'
  | 'chief_steward'
  | 'secretary_treasurer'
  | 'vice_president'
  | 'president'
  | 'admin'
  | 'national_officer'
  | 'fed_staff'
  | 'fed_executive'
  | 'clc_staff'
  | 'clc_executive'
  | 'system_admin'
  | 'platform_lead'
  | 'cto'
  | 'coo'
  | 'app_owner'

/**
 * Hierarchy levels — mirrors ROLE_HIERARCHY from api-auth-guard.ts.
 */
const ROLE_LEVELS: Record<AuthorityRole, number> = {
  member: 20,
  health_safety_rep: 30,
  bargaining_committee: 40,
  steward: 50,
  officer: 80,
  chief_steward: 90,
  secretary_treasurer: 110,
  vice_president: 120,
  president: 130,
  admin: 140,
  national_officer: 150,
  fed_staff: 160,
  fed_executive: 170,
  clc_staff: 180,
  clc_executive: 190,
  system_admin: 200,
  platform_lead: 270,
  cto: 290,
  coo: 295,
  app_owner: 300,
}

/**
 * Minimum hierarchy level required to create official work items.
 * bargaining_committee (40) is the lowest rep-level role.
 */
export const STEWARD_THRESHOLD = 40

function roleLevel(role: AuthorityRole): number {
  return ROLE_LEVELS[role] ?? 0
}

/**
 * Any authenticated user (member+) can submit an intake.
 */
export function canCreateIntake(role: AuthorityRole): boolean {
  return roleLevel(role) >= ROLE_LEVELS.member
}

/**
 * Only reps/LROs (bargaining_committee+) can create official work items.
 */
export function canCreateOfficialWorkItem(role: AuthorityRole): boolean {
  return roleLevel(role) >= STEWARD_THRESHOLD
}

/**
 * Only reps/LROs can convert an intake submission into an official case.
 */
export function canConvertIntake(role: AuthorityRole): boolean {
  return roleLevel(role) >= STEWARD_THRESHOLD
}

/**
 * Only reps/LROs can assign or modify priority on work items.
 */
export function canAssignPriority(role: AuthorityRole): boolean {
  return roleLevel(role) >= STEWARD_THRESHOLD
}

/**
 * Only chief_steward+ can override WIL-generated priorities.
 */
export function canOverridePriority(role: AuthorityRole): boolean {
  return roleLevel(role) >= ROLE_LEVELS.chief_steward
}
