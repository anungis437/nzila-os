/**
 * TrustCore — Internal Notification Hook
 *
 * POST /api/internal/notify
 *
 * Sends internal notifications through the platform notification
 * service and transactional email providers.
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
import {
  getTrustcoreNotificationService,
  sendTrustcoreEmail,
} from '@/lib/platform/notifications'
import { z } from 'zod'
import { withRequiredRole } from '@/lib/rbac/requireRole'

const NotifySchema = z.object({
  event: z.enum(['lead_captured', 'onboarding_completed_no_upgrade']),
  email: z.string().email(),
  metadata: z.record(z.unknown()).optional(),
})

export const POST = withRequiredRole(
  ['platform_admin'],
  async (req: NextRequest, ctx) => {
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
    const notificationService = getTrustcoreNotificationService()

    const content =
      event === 'lead_captured'
        ? {
            title: 'New TrustCore lead captured',
            body: 'A new TrustCore lead was captured and is ready for follow-up.',
          }
        : {
            title: 'TrustCore onboarding completed without upgrade',
            body: 'A customer completed onboarding but did not upgrade their plan.',
          }

    await notificationService.send({
      orgId: ctx.orgId,
      recipientId: email,
      title: content.title,
      body: content.body,
      channels: ['email'],
      priority: 'normal',
      metadata: {
        event,
        email,
        ...(metadata ?? {}),
      },
    })

    const emailResult = await sendTrustcoreEmail({
      orgId: ctx.orgId,
      to: email,
      subject: content.title,
      body: `${content.body}\n\n${JSON.stringify(metadata ?? {}, null, 2)}`,
    })

    if (!emailResult.ok) {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error ?? 'Email delivery failed',
        },
        { status: emailResult.provider ? 502 : 503 },
      )
    }

    return NextResponse.json({
      success: true,
      provider: emailResult.provider,
      providerMessageId: emailResult.providerMessageId ?? null,
    })
  },
)
