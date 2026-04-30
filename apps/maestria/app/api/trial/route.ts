import { NextResponse, type NextRequest } from 'next/server'
import { createOperationalRecord } from '@/lib/maestria-persistence'
import { deliverNotification } from '@/lib/maestria-notifications'
import { recordOperationalEvent } from '@/lib/maestria-analytics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>
    if (!body || typeof body !== 'object' || typeof body.email !== 'string' || typeof body.company !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid trial payload' }, { status: 400 })
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const created = createOperationalRecord({
      type: 'task',
      title: `Trial onboarding · ${body.company}`,
      body: `Activate pilot for ${body.email} and complete setup before ${trialEndsAt}.`,
      status: 'queued',
      priority: 'high',
      createdBy: 'public-trial-form',
      payload: { ...body, trialEndsAt },
    })

    deliverNotification({
      channel: 'in_app',
      recipient: 'onboarding-team',
      subject: `Trial request: ${body.company}`,
      body: `New trial submission from ${body.email}.`,
      metadata: { source: 'marketing.trial', taskId: created.id },
    })

    recordOperationalEvent({
      eventName: 'trial.requested',
      value: 1,
      unit: 'count',
      source: 'maestria.trial.api',
      dimensions: { company: body.company },
    })

    return NextResponse.json({ ok: true, trialEndsAt, accepted: true, onboardingTaskId: created.id })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create trial request' }, { status: 500 })
  }
}
