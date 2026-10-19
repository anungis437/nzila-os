/**
 * Member write policy that is narrower than generic administration.
 *
 * Removal follows `Permission.DELETE_MEMBER` through the grant capability.
 * Per-capita exemption fields have no approval capability on this boundary,
 * so client writes are denied. A future approval operation must record the
 * authenticated actor as `exemptionApprovedBy`; callers cannot supply it.
 *
 * Membership status on this table is `active`, `inactive`, or `on-leave`.
 * `inactive` cannot move directly to `on-leave`.
 */

import { MemberBoundaryError } from '@/lib/member-integrity/authorize-member-access'

export const FINANCIAL_EXEMPTION_FIELDS = [
  'exemptFromPerCapita',
  'exemptionReason',
  'exemptionApprovedBy',
] as const

export const MEMBER_RECORD_STATUSES = ['active', 'inactive', 'on-leave'] as const

export type MemberRecordStatus = (typeof MEMBER_RECORD_STATUSES)[number]

const STATUS_TRANSITIONS: Record<MemberRecordStatus, readonly MemberRecordStatus[]> = {
  active: ['inactive', 'on-leave'],
  inactive: ['active'],
  'on-leave': ['active', 'inactive'],
}

export function assertMemberStatusTransition(fromStatus: string, toStatus: string): void {
  if (!(MEMBER_RECORD_STATUSES as readonly string[]).includes(toStatus)) {
    throw new MemberBoundaryError('Forbidden')
  }
  if (fromStatus === toStatus) return
  if (!(MEMBER_RECORD_STATUSES as readonly string[]).includes(fromStatus)) {
    throw new MemberBoundaryError('Forbidden')
  }
  if (!STATUS_TRANSITIONS[fromStatus as MemberRecordStatus].includes(toStatus as MemberRecordStatus)) {
    throw new MemberBoundaryError('Forbidden')
  }
}

/**
 * Denies a client attempt to forge a per-capita exemption or its approver.
 * An explicit `false` flag on create is the inert default and is allowed.
 * Updates treat any presence of these fields as a change, including clearing one.
 */
export function rejectClientFinancialExemption(data: object, mode: 'create' | 'update'): void {
  const record = data as Record<string, unknown>
  for (const field of FINANCIAL_EXEMPTION_FIELDS) {
    if (record[field] === undefined) continue
    if (mode === 'create' && field === 'exemptFromPerCapita' && record[field] === false) continue
    throw new MemberBoundaryError('Forbidden')
  }
}

export function assertMemberRemovalPolicy(input: {
  actorUserId: string
  targetUserId: string
  targetRole: string
  otherActiveAdminCount: number
}): void {
  if (input.targetUserId === input.actorUserId) {
    throw new MemberBoundaryError('Forbidden')
  }
  if (input.targetRole === 'admin' && input.otherActiveAdminCount < 1) {
    throw new MemberBoundaryError('Forbidden')
  }
}
