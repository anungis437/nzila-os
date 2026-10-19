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
 *
 * An organization that has an active administrator must still have one after
 * the transaction commits. Only an active, non-deleted `admin` counts.
 * Callers serialize that decision with `lockAdministratorRoster`.
 */

import { and, eq, sql } from 'drizzle-orm'
import { organizationMembers } from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
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
}): void {
  if (input.targetUserId === input.actorUserId) {
    throw new MemberBoundaryError('Forbidden')
  }
}

export type AdministratorRosterRow = {
  id: string
  role: string
  status: string
  deletedAt: Date | string | null
}

export type AdministratorProjection = {
  id: string
  role?: string
  status?: string
  deletedAt?: Date | null
}

/** An administrator who can still administer: active membership, not deleted. */
export function isEffectiveAdministrator(row: {
  role: string
  status: string
  deletedAt?: Date | string | null
}): boolean {
  return row.role === 'admin' && row.status === 'active' && row.deletedAt == null
}

/**
 * Rejects a projected membership mutation that would leave the organization
 * without an active administrator. A roster that already has none does not
 * block unrelated member edits.
 */
export function assertActiveAdministratorsRemain(
  roster: readonly AdministratorRosterRow[],
  changes: readonly AdministratorProjection[],
): void {
  const before = roster.filter(isEffectiveAdministrator).length
  if (before < 1) return

  const projected = new Map(roster.map((row) => [row.id, { ...row }]))
  for (const change of changes) {
    const current = projected.get(change.id)
    if (!current) {
      if (change.role === 'admin') {
        projected.set(change.id, {
          id: change.id,
          role: 'admin',
          status: change.status ?? 'active',
          deletedAt: change.deletedAt ?? null,
        })
      }
      continue
    }
    projected.set(change.id, {
      ...current,
      role: change.role ?? current.role,
      status: change.status ?? current.status,
      deletedAt: change.deletedAt !== undefined ? change.deletedAt : current.deletedAt,
    })
  }

  const after = [...projected.values()].filter(isEffectiveAdministrator).length
  if (after < 1) throw new MemberBoundaryError('Forbidden')
}

/**
 * Serializes administrator-authority mutations for one organization.
 * The advisory lock is transaction-scoped. The following row lock is the
 * roster those mutations must project against, so two commits cannot each
 * observe a stale "another administrator remains" count.
 */
export async function lockAdministratorRoster(
  tx: RLSTx,
  organizationId: string,
): Promise<AdministratorRosterRow[]> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ue_active_admin:${organizationId}`}, 0))`,
  )
  const rows = await tx
    .select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.role, 'admin'),
      sql`${organizationMembers.deletedAt} IS NULL`,
    ))
    .for('update')
  return rows.map((row) => ({
    id: String(row.id),
    role: String(row.role),
    status: String(row.status),
    deletedAt: row.deletedAt ?? null,
  }))
}
