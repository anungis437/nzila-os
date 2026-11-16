import { NextResponse } from 'next/server'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { canManageOrganizationInvites, listOrganizationInvites } from '@nzila/platform-auth/invites'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { matchingRepresentativeEligible } from '@/lib/cases/assignment-eligibility'
import { representativeWorkloads } from '@/lib/cases/assignment-capacity'
import { AssignmentProfileInput, ASSIGNMENT_SPECIALIZATIONS } from '@/lib/cases/assignment-profile-contract'
import { requireMatchingProfileAdmin, saveAssignmentProfile } from '@/lib/cases/assignment-profiles'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { ApiError } from '@/lib/api/errors'
import { standardErrorResponse } from '@/lib/api/standardized-responses'

function profileFailure(error: unknown): NextResponse {
  if (error instanceof ApiError) return standardErrorResponse(error.code, error.message)
  throw error
}

export const GET = withOrganizationAuth(async (_request, context) => {
  if (!(await canManageOrganizationInvites(context.userId, context.organizationId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const invitations = await listOrganizationInvites(context.userId, context.organizationId)
  try {
    return await withRLSContext(async tx => {
      await requireMatchingProfileAdmin(tx, context)
      const { rows: profiles } = await drizzleExecutor(tx).query<{ id: string; userId: string; specialization: string | null; maxCaseload: number; active: boolean }>(`SELECT id::text,user_id::text AS "userId",specialization,max_caseload AS "maxCaseload",active
        FROM public.stewards WHERE org_id=$1::uuid ORDER BY id`, [context.organizationId])
      const { rows: roster } = await drizzleExecutor(tx).query<{ userId: string; name: string | null; email: string | null }>(`SELECT user_id AS "userId",name,email FROM public.organization_members
        WHERE organization_id=$1::uuid AND status='active' AND deleted_at IS NULL ORDER BY user_id`, [context.organizationId])
      const known = new Map<string, { userId: string; label: string }>()
      for (const row of roster)
        known.set(String(row.userId), { userId: String(row.userId), label: String(row.name || row.email || '') })
      for (const invite of invitations)
        if (invite.acceptedAt && invite.acceptedUserId) known.set(invite.acceptedUserId, { userId: invite.acceptedUserId, label: invite.email })
      const representatives = []
      for (const person of known.values())
        if (await matchingRepresentativeEligible(tx, context, person.userId)) representatives.push(person)
      const workload = await representativeWorkloads(tx, context.organizationId, profiles.map(profile => String(profile.userId)))
      return NextResponse.json({ profiles: profiles.map(profile => ({ ...profile, openCases: workload.get(String(profile.userId)) ?? 0 })),
        representatives: representatives.map(person => ({ userId: person.userId, label: person.label })), specializations: ASSIGNMENT_SPECIALIZATIONS })
    })
  } catch (error) { return profileFailure(error) }
})

export const PUT = withOrganizationAuth(async (request, context) => {
  if (!(await canManageOrganizationInvites(context.userId, context.organizationId)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = AssignmentProfileInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid matching profile' }, { status: 400 })
  try {
    return await withRLSContext(async tx => NextResponse.json(await saveAssignmentProfile(tx, context, parsed.data)))
  } catch (error) { return profileFailure(error) }
})
