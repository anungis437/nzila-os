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

const LeadSchema = z.object({
  email: z.string().email({ message: 'A valid email address is required.' }),
  source: z.enum(['landing', 'sample_trust_center', 'onboarding']).default('landing'),
})

export async function POST(req: NextRequest) {
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
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
