import {
  listUserOrganizations,
  createOrganization,
} from '@/lib/services/organization-admin-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Orgs CRUD
 * GET  /api/orgs          → list orgs for current user
 * POST /api/orgs          → create org (platform_admin, studio_admin, ops)
 */
import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'
import { authenticateUser, requirePlatformRole } from '@/lib/api-guards'

const CreateOrgSchema = z.object({
  legalName: z.string().min(1),
  jurisdiction: z.string().min(2).max(10),
  incorporationNumber: z.string().optional(),
  fiscalYearEnd: z
    .string()
    .regex(/^\d{2}-\d{2}$/)
    .optional(), // MM-DD
})

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  const result = await listUserOrganizations(userId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  // Only platform_admin, studio_admin, and ops can create orgs
  const authResult = await requirePlatformRole('platform_admin', 'studio_admin', 'ops')
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  const body = await req.json()
  const parsed = CreateOrgSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createOrganization(parsed.data, userId)
  return NextResponse.json(result.body, { status: result.status })
}
