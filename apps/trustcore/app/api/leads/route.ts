/**
 * TrustCore — Lead Capture API
 *
 * POST /api/leads
 *
 * Upserts a lead by email (first-touch attribution).
 * This route is PUBLIC — no auth required (pre-onboarding soft gate).
 * Does NOT expose any existing lead data back to the caller.
 *
 * Body:  { email: string; source: 'landing' | 'sample_trust_center' | 'onboarding' }
 * Returns: 200 { success: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertTrustcoreLead } from '@nzila/db/queries/trustcore'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { createLogger } from '@nzila/os-core'

const LeadSchema = z.object({
  email: z.string().email({ message: 'A valid email address is required.' }),
  source: z.enum(['landing', 'sample_trust_center', 'onboarding']).default('landing'),
})

const logger = createLogger('trustcore:api:leads')

export const POST = withRequiredRole(
  ['staff', 'org_admin', 'platform_admin'],
  async (req: NextRequest) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = LeadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Validation error' },
        { status: 422 },
      )
    }

    try {
      await upsertTrustcoreLead(parsed.data)
      return NextResponse.json({ success: true })
    } catch (err) {
      logger.error('[trustcore leads] upsert failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
    }
  },
)
