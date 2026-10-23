import { caseActionAllowed, casePolicyRole } from '@/lib/cases/case-permissions'

export type MemberDirectoryScope = 'none' | 'case-context' | 'organization'

export interface MemberDirectoryAccess {
  scope: MemberDirectoryScope
  /** Employment dates, seniority and free-form profile metadata. */
  includeSensitive: boolean
}

const DENIED: MemberDirectoryAccess = { scope: 'none', includeSensitive: false }

/** Same platform-administrator set the case policy already recognizes. */
const PLATFORM_ADMINISTRATOR_ROLES = new Set(['app_owner', 'system_admin', 'platform_lead'])

/**
 * Directory authority is derived from the case policy, not from a union-wide role name:
 * a steward sees only members whose matters are assigned to them; organization-wide reads
 * need case_read_any; sensitive attributes need officer-level authority.
 * Unknown roles and ordinary members receive nothing.
 */
export function memberDirectoryAccess(role: string | null | undefined, platformAdministrator = false): MemberDirectoryAccess {
  if (platformAdministrator || (role && PLATFORM_ADMINISTRATOR_ROLES.has(role))) {
    return { scope: 'organization', includeSensitive: true }
  }
  const policyRole = role ? casePolicyRole(role) : null
  if (!policyRole || !caseActionAllowed('note_add_internal', policyRole)) return DENIED
  if (!caseActionAllowed('case_read_any', policyRole)) return { scope: 'case-context', includeSensitive: false }
  return { scope: 'organization', includeSensitive: caseActionAllowed('case_reopen', policyRole) }
}

export interface DirectoryMemberFields {
  id: string
  userId: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  status: string
  department: string | null
  position: string | null
  hireDate: Date | null
  seniority: number | null
  membershipNumber: string | null
  unionJoinDate: Date | null
  createdAt: Date | null
  metadata: unknown
}

export function projectDirectoryMember(m: DirectoryMemberFields, access: MemberDirectoryAccess) {
  let metadata: Record<string, unknown> = {}
  if (access.includeSensitive && m.metadata) {
    if (typeof m.metadata === 'string') {
      try { metadata = JSON.parse(m.metadata) } catch { /* ignore malformed legacy metadata */ }
    } else if (typeof m.metadata === 'object') {
      metadata = m.metadata as Record<string, unknown>
    }
  }
  return {
    id: m.id,
    userId: m.userId,
    name: m.name,
    email: m.email,
    phone: m.phone || '',
    role: m.role,
    status: m.status,
    department: m.department || 'Administration',
    position: m.position || 'Union Member',
    hireDate: access.includeSensitive ? m.hireDate?.toISOString() ?? null : null,
    seniority: access.includeSensitive ? m.seniority ?? 0 : null,
    membershipNumber: m.membershipNumber || '',
    unionJoinDate: access.includeSensitive ? m.unionJoinDate?.toISOString() ?? null : null,
    createdAt: m.createdAt?.toISOString() ?? null,
    metadata,
  }
}
