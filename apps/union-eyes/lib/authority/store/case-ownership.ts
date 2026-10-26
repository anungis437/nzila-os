/**
 * Authority store — case ownership reconciliation (READ-ONLY).
 *
 * `grievances.union_rep_id` (uuid) is the legacy "primary LRO" column. Two in-repo consumers read it as a platform
 * user id (services/case-access-service.ts primary-owner check; lib/deadline-engine/recipient-resolver.ts), but it
 * is a plain mutable column with no foreign key, and every route that can UPDATE a grievance can rewrite it. It is
 * therefore NOT an authority source: deriving ownership from it would make the kernel exactly as strong as the
 * weakest legacy route. Ownership is granted only by an explicit, governed, audited assignment (`assignCase`).
 *
 * This reconciler reports how the legacy column and the kernel's assignments differ, so that the Phase 2 migration
 * can backfill through the governed path case by case. It never grants, revokes or writes anything.
 */
import type { MembershipSource } from './facts'
import { isPrincipalId, isUuid, type SqlExecutor } from './executor'

export type OwnershipDriftKind =
  | 'aligned'
  | 'backfill_candidate'
  | 'invalid_principal'
  | 'not_active_member'
  | 'not_handler_capacity'
  | 'kernel_assignee_differs'

export interface OwnershipFinding {
  caseId: string
  legacyOwner: string | null
  kernelAssignees: string[]
  kind: OwnershipDriftKind
  detail: string
}

export interface OwnershipReport {
  organizationId: string
  casesExamined: number
  findings: OwnershipFinding[]
  counts: Record<OwnershipDriftKind, number>
  truncated: boolean
}

type Row = Record<string, unknown>
const HANDLER = ['steward', 'chief_steward', 'officer'] as const

export async function reconcileCaseOwnership(
  exec: SqlExecutor,
  memberships: MembershipSource,
  organizationId: string,
  options: { limit?: number } = {},
): Promise<OwnershipReport> {
  if (!isUuid(organizationId)) throw new Error('organizationId must be a uuid')
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 5000)
  const cases = (
    await exec.query<Row>(
      `SELECT id::text AS id, union_rep_id::text AS union_rep_id FROM public.grievances
        WHERE organization_id = $1::uuid ORDER BY id LIMIT $2`,
      [organizationId, limit + 1],
    )
  ).rows
  const truncated = cases.length > limit
  const page = cases.slice(0, limit)
  const assignments = new Map<string, string[]>()
  if (page.length > 0) {
    const rows = (
      await exec.query<Row>(
        `SELECT resource_id::text AS case_id, principal_user_id FROM ue_authority_resource_relationships
          WHERE organization_id = $1::uuid AND resource_type = 'case' AND relation IN ('assignee', 'owner')
            AND status = 'active' AND revoked_at IS NULL AND effective_at <= now() AND (expires_at IS NULL OR expires_at > now())
            AND resource_id = ANY($2::uuid[])`,
        [organizationId, page.map((c) => String(c.id))],
      )
    ).rows
    for (const r of rows) assignments.set(String(r.case_id), [...(assignments.get(String(r.case_id)) ?? []), String(r.principal_user_id)])
  }

  const counts: Record<OwnershipDriftKind, number> = {
    aligned: 0, backfill_candidate: 0, invalid_principal: 0, not_active_member: 0, not_handler_capacity: 0, kernel_assignee_differs: 0,
  }
  const findings: OwnershipFinding[] = []
  const add = (f: OwnershipFinding) => { counts[f.kind]++; findings.push(f) }

  for (const c of page) {
    const caseId = String(c.id)
    const legacy = (c.union_rep_id as string | null) ?? null
    const kernel = assignments.get(caseId) ?? []
    if (legacy === null) {
      if (kernel.length > 0) add({ caseId, legacyOwner: null, kernelAssignees: kernel, kind: 'kernel_assignee_differs', detail: 'the kernel has an assignee but the legacy column is empty' })
      continue
    }
    if (!isPrincipalId(legacy)) {
      add({ caseId, legacyOwner: legacy, kernelAssignees: kernel, kind: 'invalid_principal', detail: 'union_rep_id is not a valid principal id' })
      continue
    }
    if (kernel.includes(legacy)) {
      counts.aligned++
      continue
    }
    if (kernel.length > 0) {
      add({ caseId, legacyOwner: legacy, kernelAssignees: kernel, kind: 'kernel_assignee_differs', detail: 'the legacy owner is not among the kernel assignees' })
      continue
    }
    const m = (await memberships(exec, organizationId, [legacy])).filter((x) => x.userId === legacy && x.organizationId === organizationId)
    if (m.length !== 1 || m[0].status !== 'active') {
      add({ caseId, legacyOwner: legacy, kernelAssignees: kernel, kind: 'not_active_member', detail: 'the legacy owner has no single active membership in this organization' })
    } else if (!m[0].capacities.some((cap) => (HANDLER as readonly string[]).includes(cap))) {
      add({ caseId, legacyOwner: legacy, kernelAssignees: kernel, kind: 'not_handler_capacity', detail: 'the legacy owner holds no representation capacity' })
    } else {
      add({ caseId, legacyOwner: legacy, kernelAssignees: kernel, kind: 'backfill_candidate', detail: 'eligible; needs an explicit governed assignCase to become authority' })
    }
  }
  return { organizationId, casesExamined: page.length, findings, counts, truncated }
}
