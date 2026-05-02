import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { createAuditorAccessToken } from '@/lib/auditor-token'

const IssueSchema = z.object({
  orgId: z.string().min(1),
  expiresInMinutes: z.number().int().min(5).max(60 * 24).optional(),
  issuedBy: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const body = await request.json().catch(() => null)
    const parsed = IssueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid auditor access request', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }

    const expiresInMinutes = parsed.data.expiresInMinutes ?? 60
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString()

    const token = createAuditorAccessToken({
      organizationId: parsed.data.orgId,
      expiresAt,
      issuedBy: parsed.data.issuedBy ?? 'control-plane',
    })

    return NextResponse.json({
      ok: true,
      data: {
        role: 'auditor',
        orgId: parsed.data.orgId,
        token,
        expiresAt,
        capabilities: ['audit:read', 'audit:verify', 'audit:export'],
        restrictions: ['no-mutations', 'no-policy-changes'],
      },
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
