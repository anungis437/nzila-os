import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { ApiError } from '@/lib/api/errors'
import { isActiveOrganizationAdministrator } from '@/lib/auth/organization-admin'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { matchingRepresentativeEligible } from './assignment-eligibility'
import { lockAssignmentScope, representativeWorkloads } from './assignment-capacity'
import { AssignmentProfileInput } from './assignment-profile-contract'

/** A role title supplied by a route or client is never administration authority. Re-read on the mutation transaction. */
export async function requireMatchingProfileAdmin(tx: RLSTx, actor: { userId: string; organizationId: string }) {
  if (!(await isActiveOrganizationAdministrator(tx, actor))) throw ApiError.forbidden()
}

export async function saveAssignmentProfile(tx: RLSTx, actor: { userId: string; organizationId: string }, input: z.infer<typeof AssignmentProfileInput>) {
  // Validate here too: callers cannot bypass the HTTP contract.
  const data = AssignmentProfileInput.parse(input)
  await lockAssignmentScope(tx, actor.organizationId)
  await requireMatchingProfileAdmin(tx, actor)
  const exec = drizzleExecutor(tx)
  const { rows: existing } = await exec.query<{ id: string }>(`SELECT id::text FROM public.stewards
    WHERE org_id=$1::uuid AND user_id=$2::uuid ORDER BY id FOR UPDATE`, [actor.organizationId, data.userId])
  if (existing.length > 1) throw ApiError.conflict('Conflicting matching profiles require reconciliation')
  if ((data.active || existing.length === 0) && !(await matchingRepresentativeEligible(tx, actor, data.userId)))
    throw ApiError.forbidden('An active representative in this organization is required')
  const open = (await representativeWorkloads(tx, actor.organizationId, [data.userId])).get(data.userId) ?? 0
  if (data.active && data.maxCaseload < open) throw ApiError.conflict('Capacity cannot be lower than the current open caseload')
  const id = existing[0]?.id ?? randomUUID()
  if (existing.length)
    await exec.query(`UPDATE public.stewards SET specialization=$3,max_caseload=$4,active=$5,current_caseload=$6,updated_at=now()
      WHERE id=$1::uuid AND org_id=$2::uuid`, [id, actor.organizationId, data.specialization, data.maxCaseload, data.active, open])
  else
    await exec.query(`INSERT INTO public.stewards(id,org_id,user_id,specialization,max_caseload,current_caseload,active)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7)`, [id, actor.organizationId, data.userId, data.specialization, data.maxCaseload, open, data.active])
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId,
    action: 'representative.matching_profile.saved', resourceType: 'stewards', resourceId: id,
    details: { representativeUserId: data.userId, specialization: data.specialization, maxCaseload: data.maxCaseload, active: data.active, openCases: open } })
  return { id, ...data, openCases: open }
}
