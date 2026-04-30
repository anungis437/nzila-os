import { NextResponse, type NextRequest } from 'next/server'
import { createOperationalRecord } from '@/lib/maestria-persistence'
import { deliverNotification } from '@/lib/maestria-notifications'
import { recordOperationalEvent } from '@/lib/maestria-analytics'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>
    if (!body || typeof body !== 'object' || typeof body.email !== 'string') {
      return NextResponse.json({ ok: false, error: 'Invalid contact payload' }, { status: 400 })
    }

    const created = createOperationalRecord({
      type: 'comment',
      title: `Inbound contact · ${body.email}`,
      body: typeof body.message === 'string' ? body.message : 'Marketing contact request',
      status: 'new',
      priority: 'normal',
      createdBy: 'public-contact-form',
      payload: body,
    })

    deliverNotification({
      channel: 'email',
      recipient: process.env.MAESTRIA_CONTACT_INBOX ?? 'ops@shopmoica.com',
      subject: `New contact request from ${body.email}`,
      body: typeof body.message === 'string' ? body.message : 'Contact request received.',
      metadata: { source: 'marketing.contact', recordId: created.id },
    })

    recordOperationalEvent({
      eventName: 'contact.submitted',
      value: 1,
      unit: 'count',
      source: 'maestria.contact.api',
      dimensions: { locale: typeof body.locale === 'string' ? body.locale : 'unknown' },
    })

    return NextResponse.json({ ok: true, accepted: true, recordId: created.id })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Failed to process contact request' }, { status: 500 })
  }
}
