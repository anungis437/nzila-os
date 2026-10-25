/**
 * Membership authority drift check (UE-CONV-A-005): a READ-ONLY comparison between the compatibility projection the
 * kernel and the v2 predicates read (`user_management.organization_users` joined to `user_management.users`) and the
 * canonical table the platform resolver targets (`public.platform_organization_memberships`).
 *
 * Nothing here moves a reader or writes a row. It makes drift DETECTABLE: a pure comparison over two snapshots, plus
 * the two fixed SELECTs that produce them. The projection side is mapped through the kernel's own membership mapping
 * (`mapMembershipRows`) so "active" means exactly what the kernel means by it.
 *
 * Risk is stated from the kernel's point of view, because the kernel reads the projection:
 *   PROJECTION_GRANTS_CANONICAL_DENIES  the kernel would treat the person as an active member while the canonical
 *                                       record says they are not (a stale grant: the dangerous direction);
 *   CANONICAL_GRANTS_PROJECTION_DENIES  the kernel denies someone the canonical record says is active (availability);
 *   NEUTRAL                             a difference that does not change who is active.
 */
import { capacitiesForRole } from '../capacity'
import type { MembershipStatus } from '../ontology'
import type { SqlExecutor } from './executor'
import { mapMembershipRows } from './identity'

export interface ProjectionMembershipRow {
  userId: string
  organizationId: string
  role: string | null
  memberActive: boolean | null
  userActive: boolean | null
  lifecycleState: string | null
}

export interface CanonicalMembershipRow {
  platformUserId: string
  organizationId: string
  role: string | null
  state: string
  effectiveFrom: Date | string
  effectiveTo: Date | string | null
  revokedAt: Date | string | null
}

export type DriftKind =
  | 'MISSING_IN_CANONICAL'
  | 'MISSING_IN_PROJECTION'
  | 'STATUS_MISMATCH'
  | 'ROLE_MISMATCH'
  | 'DUPLICATE_PROJECTION'
  | 'DUPLICATE_CANONICAL'
  | 'UNREADABLE_ROW'

export type DriftRisk = 'PROJECTION_GRANTS_CANONICAL_DENIES' | 'CANONICAL_GRANTS_PROJECTION_DENIES' | 'NEUTRAL'

export interface MembershipDrift {
  kind: DriftKind
  risk: DriftRisk
  organizationId: string
  userId: string
  projectionStatus: MembershipStatus | null
  canonicalStatus: MembershipStatus | null
  detail: string
}

export interface MembershipReconciliation {
  /** True only when no drift of any kind was found. */
  consistent: boolean
  projectionRows: number
  canonicalRows: number
  drifts: MembershipDrift[]
  /** Drifts where the kernel (which reads the projection) would grant what the canonical record does not. */
  staleGrants: number
  summary: Record<DriftKind, number>
}

export interface ReconcileOptions {
  now?: Date
  /** Maps a projection role name to the canonical vocabulary when the two differ. Defaults to a trimmed, lower-cased identity. */
  normalizeRole?: (role: string) => string
}

const KINDS: readonly DriftKind[] = [
  'MISSING_IN_CANONICAL',
  'MISSING_IN_PROJECTION',
  'STATUS_MISMATCH',
  'ROLE_MISMATCH',
  'DUPLICATE_PROJECTION',
  'DUPLICATE_CANONICAL',
  'UNREADABLE_ROW',
]

const keyOf = (organizationId: string, userId: string) => `${organizationId.toLowerCase()}|${userId}`

const toTime = (value: Date | string | null): number | null => {
  if (value === null) return null
  const t = (value instanceof Date ? value : new Date(value)).getTime()
  if (Number.isNaN(t)) throw new Error(`unmappable timestamp: ${String(value)}`)
  return t
}

/** Canonical membership as the platform resolver would judge it at `now`. Unknown states throw (fail closed). */
export function canonicalMembershipStatus(row: CanonicalMembershipRow, now: Date): MembershipStatus {
  if (row.revokedAt !== null && row.revokedAt !== undefined) return 'revoked'
  switch (row.state) {
    case 'revoked':
      return 'revoked'
    case 'suspended':
      return 'suspended'
    case 'invited':
      return 'inactive'
    case 'active': {
      const from = toTime(row.effectiveFrom)
      const to = toTime(row.effectiveTo)
      if (from === null || from > now.getTime()) return 'inactive'
      if (to !== null && to <= now.getTime()) return 'inactive'
      return 'active'
    }
    default:
      throw new Error(`unknown canonical membership state: ${String(row.state)}`)
  }
}

/** Projection membership exactly as the kernel's membership source maps it. */
export function projectionMembershipStatus(row: ProjectionMembershipRow): MembershipStatus {
  return mapMembershipRows([
    {
      user_id: row.userId,
      organization_id: row.organizationId,
      role: row.role,
      member_active: row.memberActive,
      user_active: row.userActive,
      lifecycle_state: row.lifecycleState ?? 'unknown',
    },
  ])[0].status
}

function group<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = out.get(k)
    if (list) list.push(row)
    else out.set(k, [row])
  }
  return out
}

const sameCapacities = (a: string | null, b: string | null): boolean => {
  const left = [...capacitiesForRole(a)].sort().join(',')
  const right = [...capacitiesForRole(b)].sort().join(',')
  return left === right
}

export function reconcileMembershipProjection(
  projection: readonly ProjectionMembershipRow[],
  canonical: readonly CanonicalMembershipRow[],
  options: ReconcileOptions = {},
): MembershipReconciliation {
  const now = options.now ?? new Date()
  const normalizeRole = options.normalizeRole ?? ((role: string) => role.trim().toLowerCase())
  const drifts: MembershipDrift[] = []
  const add = (drift: MembershipDrift) => drifts.push(drift)

  const projectionBy = group(projection, (r) => keyOf(r.organizationId, r.userId))
  const canonicalBy = group(canonical, (r) => keyOf(r.organizationId, r.platformUserId))
  const keys = new Set([...projectionBy.keys(), ...canonicalBy.keys()])

  for (const key of [...keys].sort()) {
    const left = projectionBy.get(key) ?? []
    const right = canonicalBy.get(key) ?? []
    const organizationId = (left[0]?.organizationId ?? right[0]?.organizationId) as string
    const userId = (left[0]?.userId ?? right[0]?.platformUserId) as string
    const base = { organizationId, userId }

    // Two rows for one person in one organization cannot be judged: the kernel itself denies on a duplicate.
    if (left.length > 1) {
      add({ ...base, kind: 'DUPLICATE_PROJECTION', risk: 'NEUTRAL', projectionStatus: null, canonicalStatus: null, detail: `${left.length} projection rows` })
    }
    if (right.length > 1) {
      add({ ...base, kind: 'DUPLICATE_CANONICAL', risk: 'NEUTRAL', projectionStatus: null, canonicalStatus: null, detail: `${right.length} canonical rows` })
    }
    if (left.length > 1 || right.length > 1) continue

    let projectionStatus: MembershipStatus | null = null
    let canonicalStatus: MembershipStatus | null = null
    try {
      projectionStatus = left[0] ? projectionMembershipStatus(left[0]) : null
      canonicalStatus = right[0] ? canonicalMembershipStatus(right[0], now) : null
    } catch (error) {
      add({
        ...base,
        kind: 'UNREADABLE_ROW',
        risk: left[0] && projectionMembershipStatus(left[0]) === 'active' ? 'PROJECTION_GRANTS_CANONICAL_DENIES' : 'NEUTRAL',
        projectionStatus,
        canonicalStatus,
        detail: error instanceof Error ? error.message : 'unreadable row',
      })
      continue
    }

    if (!left[0]) {
      add({
        ...base,
        kind: 'MISSING_IN_PROJECTION',
        risk: canonicalStatus === 'active' ? 'CANONICAL_GRANTS_PROJECTION_DENIES' : 'NEUTRAL',
        projectionStatus,
        canonicalStatus,
        detail: 'canonical membership has no compatibility projection row',
      })
      continue
    }
    if (!right[0]) {
      add({
        ...base,
        kind: 'MISSING_IN_CANONICAL',
        risk: projectionStatus === 'active' ? 'PROJECTION_GRANTS_CANONICAL_DENIES' : 'NEUTRAL',
        projectionStatus,
        canonicalStatus,
        detail: 'compatibility projection row has no canonical membership',
      })
      continue
    }

    if (projectionStatus !== canonicalStatus) {
      const projectionActive = projectionStatus === 'active'
      const canonicalActive = canonicalStatus === 'active'
      add({
        ...base,
        kind: 'STATUS_MISMATCH',
        risk:
          projectionActive && !canonicalActive
            ? 'PROJECTION_GRANTS_CANONICAL_DENIES'
            : canonicalActive && !projectionActive
              ? 'CANONICAL_GRANTS_PROJECTION_DENIES'
              : 'NEUTRAL',
        projectionStatus,
        canonicalStatus,
        detail: `projection is ${projectionStatus}, canonical is ${canonicalStatus}`,
      })
    }

    const leftRole = left[0].role === null ? null : normalizeRole(left[0].role)
    const rightRole = right[0].role === null ? null : normalizeRole(right[0].role)
    if (leftRole !== rightRole) {
      const capacityDrift = !sameCapacities(leftRole, rightRole)
      add({
        ...base,
        kind: 'ROLE_MISMATCH',
        risk: 'NEUTRAL',
        projectionStatus,
        canonicalStatus,
        detail: `projection role '${leftRole}', canonical role '${rightRole}'${capacityDrift ? ' (eligibility capacities differ)' : ''}`,
      })
    }
  }

  const summary = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<DriftKind, number>
  for (const d of drifts) summary[d.kind] += 1
  return {
    consistent: drifts.length === 0,
    projectionRows: projection.length,
    canonicalRows: canonical.length,
    drifts,
    staleGrants: drifts.filter((d) => d.risk === 'PROJECTION_GRANTS_CANONICAL_DENIES').length,
    summary,
  }
}

type Row = Record<string, unknown>

/** Fixed, read-only SELECTs. The optional organization filter is a bound parameter, never interpolated. */
export async function loadMembershipSnapshots(
  exec: SqlExecutor,
  organizationId?: string,
): Promise<{ projection: ProjectionMembershipRow[]; canonical: CanonicalMembershipRow[] }> {
  const params = organizationId ? [organizationId] : []
  const filter = (column: string) => (organizationId ? `WHERE ${column} = $1::uuid` : '')
  const projection = (
    await exec.query<Row>(
      `SELECT m.user_id, m.organization_id::text AS organization_id, m.role, m.is_active AS member_active,
              u.is_active AS user_active, u.lifecycle_state
         FROM user_management.organization_users m
         LEFT JOIN user_management.users u ON u.user_id = m.user_id
        ${filter('m.organization_id')}`,
      params,
    )
  ).rows.map(
    (r): ProjectionMembershipRow => ({
      userId: String(r.user_id),
      organizationId: String(r.organization_id),
      role: (r.role as string | null) ?? null,
      memberActive: r.member_active === null || r.member_active === undefined ? null : r.member_active === true,
      userActive: r.user_active === null || r.user_active === undefined ? null : r.user_active === true,
      lifecycleState: (r.lifecycle_state as string | null) ?? null,
    }),
  )
  const canonical = (
    await exec.query<Row>(
      `SELECT platform_user_id, organization_id::text AS organization_id, role, state, effective_from, effective_to, revoked_at
         FROM public.platform_organization_memberships
        ${filter('organization_id')}`,
      params,
    )
  ).rows.map(
    (r): CanonicalMembershipRow => ({
      platformUserId: String(r.platform_user_id),
      organizationId: String(r.organization_id),
      role: (r.role as string | null) ?? null,
      state: String(r.state),
      effectiveFrom: r.effective_from as Date | string,
      effectiveTo: (r.effective_to as Date | string | null) ?? null,
      revokedAt: (r.revoked_at as Date | string | null) ?? null,
    }),
  )
  return { projection, canonical }
}

export async function reconcileMembershipsFromDatabase(
  exec: SqlExecutor,
  options: ReconcileOptions & { organizationId?: string } = {},
): Promise<MembershipReconciliation> {
  const { projection, canonical } = await loadMembershipSnapshots(exec, options.organizationId)
  return reconcileMembershipProjection(projection, canonical, options)
}
