/**
 * GET/PUT /api/auth/policy
 *
 * Org-admin endpoint to read and update the auth policy (allowed methods,
 * SSO enforcement, email domain allowlist, session TTL, MFA-required roles).
 *
 * Requires admin role or higher on the active organization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { hasMinRole } from '@/lib/api-auth-guard'
import { getOrgAuthPolicy } from '@nzila/platform-auth/policy'
import { updateOrgAuthPolicy } from '@nzila/platform-auth/policy/admin'

export const runtime = 'nodejs'

const putSchema = z.object({
  allowLocalAuth: z.boolean().optional(),
  allowMagicLink: z.boolean().optional(),
  allowSso: z.boolean().optional(),
  requireSso: z.boolean().optional(),
  requireInvite: z.boolean().optional(),
  passwordResetAllowed: z.boolean().optional(),
  allowedEmailDomains: z.array(z.string()).optional(),
  mfaRequiredForRoles: z.array(z.string()).optional(),
})

export const GET = withOrganizationAuth(async (_request, context) => {
  const allowed = await hasMinRole('admin')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const policy = await getOrgAuthPolicy(context.organizationId)
  return NextResponse.json(policy)
})

export const PUT = withOrganizationAuth(async (request, context) => {
  const allowed = await hasMinRole('admin')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: any
  try {
    body = await (request as NextRequest).json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const result = await updateOrgAuthPolicy({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    patch: parsed.data,
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result.policy)
})
