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

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  organization: z.string().optional(),
  role: z.string().optional(),
  inquiryType: z.string().optional(),
  message: z.string().max(2000).optional(),
  source: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())
    const orgId = resolveCommercialOrgId(process.env.PLATFORM_ORG_ID)
    const actorId = resolveSystemActorId('contact-lead')

    const contactPayload = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      properties: {
        ...(body.organization ? { company: body.organization } : {}),
        ...(body.role ? { jobtitle: body.role } : {}),
        ...(body.inquiryType ? { zonga_inquiry_type: body.inquiryType } : {}),
        zonga_source: body.source ?? 'zonga-contact-form',
      },
    }

    const contactResult = await upsertZongaLead(contactPayload)
    const contactId: string | null = contactResult.ok ? contactResult.id : null
    let queued = false

    if (!contactResult.ok) {
      await enqueueCrmRetryJob(
        { op: 'lead_upsert', contact: contactPayload },
        `crm:lead:${body.email.toLowerCase()}`,
      )
      queued = true
    }

    const dealPayload = {
        name: `Zonga lead - ${body.organization || body.email}`,
        stage: 'inquiry',
        contactId: contactId ?? 'pending-contact',
        properties: {
          ...(body.message ? { zonga_message: body.message.slice(0, 500) } : {}),
          zonga_source: body.source ?? 'zonga-contact-form',
          zonga_close_probability: '0.20',
        },
      }

    if (contactId) {
      const dealResult = await createZongaDeal(dealPayload)
      if (!dealResult.ok) {
        await enqueueCrmRetryJob(
          { op: 'deal_create', deal: dealPayload },
          `crm:deal:${body.email.toLowerCase()}:${body.inquiryType ?? 'general'}`,
        )
        queued = true
      }
    } else {
      await enqueueCrmRetryJob(
        { op: 'deal_create', deal: dealPayload },
        `crm:deal:${body.email.toLowerCase()}:${body.inquiryType ?? 'general'}`,
      )
      queued = true
    }

    void bus.emit(emitLeadCreated(
      {
        leadId: contactId ?? crypto.randomUUID(),
        email: body.email,
        firstName: body.firstName,
        company: body.organization,
        source: body.source ?? 'zonga-contact-form',
        appId: 'zonga',
        inquiryType: body.inquiryType,
      },
      { orgId, actorId },
    ))

    if (queued) {
      return NextResponse.json(
        {
          ok: false,
          queued: true,
          error: 'CRM temporarily unavailable; lead queued for retry worker',
          contactId,
        },
        { status: 202 },
      )
    }

    return NextResponse.json({ ok: true, queued: false, contactId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Failed to process contact lead' }, { status: 500 })
  }
}
