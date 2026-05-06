/**
 * TrustCore — Lead Conversion API
 *
 * POST /api/leads/convert
 *
 * Marks a captured lead as converted after onboarding completion.
 * Sets convertedAt and the authenticated orgId on the matching email record.
 *
 * Access: org_admin (authenticated — called by client after onboarding success)
 * Body:   { email: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { convertTrustcoreLead } from '@nzila/db/queries/trustcore'

const ConvertSchema = z.object({
  email: z.string().email(),
})

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (req: NextRequest, ctx) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = ConvertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Valid email required' }, { status: 422 })
    }

    // Best-effort — if no matching lead exists, that's fine (user skipped email capture)
    await convertTrustcoreLead(parsed.data.email, ctx.orgId).catch(() => {})

    return NextResponse.json({ success: true })
  },
)
