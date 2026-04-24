import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  upsertZongaLead,
  createZongaDeal,
  enqueueCrmRetryJob,
} from '@/lib/services/crm-service'
import { emitLeadCreated } from '@nzila/platform-events/commercial'
import { PlatformEventBus } from '@nzila/platform-events'
import { resolveCommercialOrgId, resolveSystemActorId } from '@/lib/commercial-context'

const bus = new PlatformEventBus()

const waitlistSchema = z.object({
  firstName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['artist', 'label', 'promoter', 'fan', 'other']).default('other'),
  city: z.string().optional(),
  interests: z.array(z.string()).max(5).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = waitlistSchema.parse(await request.json())
    const orgId = resolveCommercialOrgId(process.env.PLATFORM_ORG_ID)
    const actorId = resolveSystemActorId('waitlist-lead')

    const source = 'zonga-beta-waitlist'
    const contactPayload = {
      email: body.email,
      firstName: body.firstName,
      properties: {
        ...(body.city ? { city: body.city } : {}),
        zonga_source: source,
        zonga_waitlist_role: body.role,
        zonga_waitlist_status: 'beta_pending',
        ...(body.interests?.length
          ? { zonga_waitlist_interests: body.interests.join(',') }
          : {}),
      },
    }

    const contactResult = await upsertZongaLead(contactPayload)
    const contactId: string | null = contactResult.ok ? contactResult.id : null
    let queued = false

    if (!contactResult.ok) {
      await enqueueCrmRetryJob(
        { op: 'lead_upsert', contact: contactPayload },
        `crm:waitlist:lead:${body.email.toLowerCase()}`,
      )
      queued = true
    }

    const dealPayload = {
      name: `Zonga beta waitlist - ${body.firstName}`,
      stage: 'inquiry',
      contactId: contactId ?? 'pending-contact',
      properties: {
        zonga_source: source,
        zonga_waitlist_role: body.role,
        ...(body.city ? { zonga_waitlist_city: body.city } : {}),
        ...(body.interests?.length
          ? { zonga_waitlist_interests: body.interests.join(',') }
          : {}),
        zonga_close_probability: '0.15',
      },
    }

    if (contactId) {
      const dealResult = await createZongaDeal(dealPayload)
      if (!dealResult.ok) {
        await enqueueCrmRetryJob(
          { op: 'deal_create', deal: dealPayload },
          `crm:waitlist:deal:${body.email.toLowerCase()}`,
        )
        queued = true
      }
    } else {
      await enqueueCrmRetryJob(
        { op: 'deal_create', deal: dealPayload },
        `crm:waitlist:deal:${body.email.toLowerCase()}`,
      )
      queued = true
    }

    void bus.emit(emitLeadCreated(
      {
        leadId: contactId ?? crypto.randomUUID(),
        email: body.email,
        firstName: body.firstName,
        source,
        appId: 'zonga',
        inquiryType: 'beta_waitlist',
      },
      { orgId, actorId },
    ))

    if (queued) {
      return NextResponse.json(
        {
          ok: false,
          queued: true,
          error: 'CRM temporarily unavailable; waitlist lead queued for retry worker',
          contactId,
        },
        { status: 202 },
      )
    }

    return NextResponse.json({ ok: true, queued: false, contactId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: false, error: 'Failed to join waitlist' }, { status: 500 })
  }
}
