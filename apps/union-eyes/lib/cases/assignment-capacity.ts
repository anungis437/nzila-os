import type { RLSTx } from '@/lib/db/with-rls-context'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { AuthorityStoreError } from '@/lib/authority/store/executor'

/** Parent case row, organization routing lock, then profile rows: every primary-assignment writer uses this order. */
export async function lockAssignmentScope(tx: RLSTx, organizationId: string) {
  await drizzleExecutor(tx).query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ue:assignment:${organizationId}`])
}

/** Operational counts only: no other case's identity, narrative or classification leaves this query. */
export async function representativeWorkloads(tx: RLSTx, organizationId: string, userIds: string[], exceptCaseId: string | null = null) {
  const rows = (await drizzleExecutor(tx).query<{ user_id: string; open_cases: number | string }>(`
    SELECT r.principal_user_id AS user_id, count(DISTINCT r.resource_id)::int AS open_cases
    FROM ue_authority_resource_relationships r
    LEFT JOIN public.grievances g ON g.id=r.resource_id AND g.organization_id=r.organization_id
    LEFT JOIN public.claims c ON c.claim_id=r.resource_id AND c.organization_id=r.organization_id
    WHERE r.organization_id=$1::uuid AND r.principal_user_id=ANY($2::text[])
      AND r.resource_type='case' AND r.relation IN ('owner','assignee')
      AND r.status='active' AND r.revoked_at IS NULL AND r.effective_at<=now()
      AND (r.expires_at IS NULL OR r.expires_at>now())
      AND ($3::uuid IS NULL OR r.resource_id<>$3::uuid)
      AND ((g.id IS NOT NULL AND g.status::text NOT IN ('settled','withdrawn','denied','closed','converted','closed_no_case'))
        OR (g.id IS NULL AND c.claim_id IS NOT NULL AND c.status::text NOT IN ('resolved','rejected','closed')))
    GROUP BY r.principal_user_id`, [organizationId, userIds, exceptCaseId])).rows
  return new Map(rows.map(row => [row.user_id, Number(row.open_cases)]))
}

export async function requireRepresentativeCapacity(tx: RLSTx, organizationId: string, userId: string, caseId: string) {
  const profiles = (await drizzleExecutor(tx).query<{ active: boolean; max_caseload: number }>(
    'SELECT active,max_caseload FROM public.stewards WHERE org_id=$1::uuid AND user_id::text=$2 ORDER BY id FOR UPDATE',
    [organizationId, userId],
  )).rows
  // Manual assignment retains its existing eligible-representative path when no matching profile is configured.
  if (profiles.length === 0) return
  const profile = profiles[0]!
  if (profiles.length !== 1 || !profile.active || !Number.isSafeInteger(profile.max_caseload) || profile.max_caseload < 1)
    throw new AuthorityStoreError('PRECONDITION', 'Representative availability or capacity is not valid')
  const open = (await representativeWorkloads(tx, organizationId, [userId], caseId)).get(userId) ?? 0
  if (open >= profile.max_caseload) throw new AuthorityStoreError('PRECONDITION', 'Representative has reached the configured capacity')
}

/** Keep the old display counter aligned with the authoritative relationships, including the outgoing representative. */
export async function refreshRepresentativeWorkloads(tx: RLSTx, organizationId: string, userIds: string[]) {
  const ids = [...new Set(userIds)]
  const workloads = await representativeWorkloads(tx, organizationId, ids)
  for (const userId of ids)
    await drizzleExecutor(tx).query('UPDATE public.stewards SET current_caseload=$3,updated_at=now() WHERE org_id=$1::uuid AND user_id::text=$2',
      [organizationId, userId, workloads.get(userId) ?? 0])
}
