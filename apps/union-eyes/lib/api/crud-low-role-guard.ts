import { eq, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { ApiError } from '@/lib/api/errors'
import { getRoleLevel, UserRole } from '@/lib/auth/roles'
import { getUserRoleInOrganization } from '@/lib/organization-utils'

/**
 * Generic CRUD routes are tenant-scoped only. Without this guard a member reaches every
 * personal row in their organization through them. Callers below steward are therefore held to
 * their own rows (or refused) on any table that holds personal data and declares no explicit
 * owner scope. Staff behaviour is unchanged.
 */
const PERSONAL_COLUMNS = ['email', 'phone', 'phoneNumber', 'mobile', 'address', 'dateOfBirth', 'senderId', 'recipientId', 'employeeId', 'memberId', 'userId'] as const
const OWNER_COLUMNS = ['userId', 'memberId'] as const
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export type LowRoleMode =
  | { kind: 'open' }
  | { kind: 'own'; name: string; column: PgColumn }
  | { kind: 'deny' }

const col = (table: PgTable, name: string) => (table as unknown as Record<string, PgColumn | undefined>)[name]

export function lowRoleModeFor(table: PgTable, hasExplicitOwner: boolean): LowRoleMode {
  if (hasExplicitOwner) return { kind: 'open' }
  for (const name of OWNER_COLUMNS) {
    const column = col(table, name)
    if (column) return { kind: 'own', name, column }
  }
  return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }
}

export async function isBelowStaff(userId: string | null | undefined, organizationId: string | null | undefined): Promise<boolean> {
  if (!userId || !organizationId) return true
  const role = await getUserRoleInOrganization(userId, organizationId).catch(() => null)
  return !role || getRoleLevel(role as UserRole) < getRoleLevel(UserRole.STEWARD)
}

export interface LowRoleScope {
  /** Extra WHERE condition restricting the caller to their own rows. */
  condition?: SQL
  /** Owner value a create must carry, overriding anything in the request body. */
  forcedOwner?: { name: string; value: string }
}

/** Own-rows scope that applies at every role, for tables whose cross-member reads belong to a dedicated authority. */
export function ownRowsScope(mode: LowRoleMode, userId: string | null | undefined): LowRoleScope {
  if (mode.kind !== 'own' || !userId) throw ApiError.forbidden()
  if ((mode.column as unknown as { columnType?: string }).columnType === 'PgUUID' && !UUID.test(userId)) throw ApiError.forbidden()
  return { condition: eq(mode.column, userId), forcedOwner: { name: mode.name, value: userId } }
}

/** Throws when the caller may not use the table at all; otherwise returns the scope to apply. */
export async function resolveLowRoleScope(mode: LowRoleMode, userId: string | null | undefined, organizationId: string | null | undefined): Promise<LowRoleScope> {
  if (mode.kind === 'open') return {}
  if (!(await isBelowStaff(userId, organizationId))) return {}
  if (mode.kind === 'deny' || !userId) throw ApiError.forbidden()
  // A uuid owner column can never equal a non-uuid identity; refuse rather than error.
  if ((mode.column as unknown as { columnType?: string }).columnType === 'PgUUID' && !UUID.test(userId)) throw ApiError.forbidden()
  return { condition: eq(mode.column, userId), forcedOwner: { name: mode.name, value: userId } }
}
