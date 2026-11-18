import { addOrganizationMember } from '@/lib/services/organization-admin-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Org People (Member Management)
 * POST /api/orgs/[orgId]/people → add member to org
 *
 * REM-09: All member-management mutations emit audit events.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'

import { z } from 'zod'

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['org_admin', 'org_secretary', 'org_viewer']),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params

  return withSpan('api.orgs.people.add', { orgId }, async () => {
    const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
    if (!access.ok) return access.response

    const body = await request.json()
    const parsed = AddMemberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await addOrganizationMember(orgId, parsed.data, access.context)
    return NextResponse.json(result.body, { status: result.status })
  })
}
