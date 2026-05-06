/**
 * TrustCore — Internal Notification Hook (dev stub)
 *
 * POST /api/internal/notify
 *
 * Lightweight email notification hook. In production this would
 * call an SMTP provider or transactional email service. For now
 * it logs the event and returns 200 — ready to be wired up.
 *
 * Access: platform_admin or internal service (no public access)
 *
 * Body: {
 *   event: 'lead_captured' | 'onboarding_completed_no_upgrade'
 *   email: string
 *   metadata?: Record<string, unknown>
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequiredRole } from '@/lib/rbac/requireRole'

const NotifySchema = z.object({
  event: z.enum(['lead_captured', 'onboarding_completed_no_upgrade']),
  email: z.string().email(),
  metadata: z.record(z.unknown()).optional(),
})

export const POST = withRequiredRole(
  ['platform_admin'],
  async (req: NextRequest) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = NotifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation error' }, { status: 422 })
    }

    const { event, email, metadata } = parsed.data

    // ── Email provider hook (log-only stub) ───────────────────────────────
    // When a provider is connected, replace this with:
    //   await sendEmail({ to: email, template: event, data: metadata })
    console.info('[TrustCore notify]', { event, email, metadata, sentAt: new Date().toISOString() })

    return NextResponse.json({ success: true, note: 'Email provider not yet configured — logged only.' })
  },
)
