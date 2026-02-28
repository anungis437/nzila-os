// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Orgs CRUD
 * GET  /api/orgs          → list orgs for current user
 * POST /api/orgs          → create org (platform_admin, studio_admin, ops)
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { orgs, orgMembers } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { authenticateUser, requirePlatformRole } from '@/lib/api-guards'

const CreateOrgSchema = z.object({
  legalName: z.string().min(1),
  jurisdiction: z.string().min(2).max(10),
  incorporationNumber: z.string().optional(),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/).optional(), // MM-DD
})

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // Return orgs where user is a member
  const rows = await platformDb
    .select({
      id: orgs.id,
      legalName: orgs.legalName,
      jurisdiction: orgs.jurisdiction,
      incorporationNumber: orgs.incorporationNumber,
      fiscalYearEnd: orgs.fiscalYearEnd,
      status: orgs.status,
      createdAt: orgs.createdAt,
    })
    .from(orgs)
    .innerJoin(orgMembers, and(
      eq(orgMembers.orgId, orgs.id),
      eq(orgMembers.clerkUserId, userId),
      eq(orgMembers.status, 'active'),
    ))

  return NextResponse.json(rows)
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

  const [org] = await platformDb
    .insert(orgs)
    .values({
      legalName: parsed.data.legalName,
      jurisdiction: parsed.data.jurisdiction,
      incorporationNumber: parsed.data.incorporationNumber ?? null,
      fiscalYearEnd: parsed.data.fiscalYearEnd ?? null,
    })
    .returning()

  // Auto-add creator as org_admin
  await platformDb.insert(orgMembers).values({
    orgId: org.id,
    clerkUserId: userId,
    role: 'org_admin',
  })

  return NextResponse.json(org, { status: 201 })
}
