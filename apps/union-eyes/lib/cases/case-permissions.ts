import { canPerformAction, type CUPEAction, type CUPERole, type ActionContext } from '@/lib/action-enforcer'

/** Case policy aliases; unknown organizational roles never acquire a member fallback. */
const aliases: Record<string, CUPERole> = {
  member: 'member', steward: 'steward', chief_steward: 'chief_steward',
  business_agent: 'business_agent', officer: 'officer', admin: 'admin',
  president: 'officer', vice_president: 'officer', secretary_treasurer: 'officer',
  national_officer: 'officer', union_rep: 'steward', staff_rep: 'steward',
  executive: 'officer', ceo: 'officer', governance: 'officer',
  union_steward: 'steward', union_staff: 'steward', union_officer: 'officer', union_admin: 'admin',
}

export function casePolicyRole(role: string): CUPERole | null {
  return aliases[role] ?? null
}

export function caseActionAllowed(action: CUPEAction, role: CUPERole, context?: ActionContext): boolean {
  return canPerformAction(action, role, context).allowed
}

/** Canonical membership names only: no public-role metadata or platform-admin flag promotion. */
export const CASE_ASSIGNEE_MEMBERSHIP_ROLES = [
  'steward', 'chief_steward', 'officer', 'admin',
  'president', 'vice_president', 'secretary_treasurer', 'national_officer',
  'union_rep', 'staff_rep', 'executive', 'ceo', 'governance',
] as const
