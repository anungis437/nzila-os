import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertFlowLead, createFlowDeal } from '@/lib/services/crm-service'
import { emitLeadCreated } from '@nzila/platform-events/commercial'
import { PlatformEventBus } from '@nzila/platform-events'

const bus = new PlatformEventBus()

const bodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  company: z.string().optional(),
  role: z.string().optional(),
  inquiryType: z.string().optional(),
  message: z.string().max(2000).optional(),
  source: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())

    const contactId = await upsertFlowLead({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      properties: {
        ...(body.company ? { company: body.company } : {}),
        ...(body.role ? { jobtitle: body.role } : {}),
        ...(body.inquiryType ? { flow_inquiry_type: body.inquiryType } : {}),
        flow_source: body.source ?? 'flow-contact-form',
      },
    })

    if (contactId) {
      await createFlowDeal({
        name: `Flow lead - ${body.company || body.email}`,
        stage: 'inquiry',
        contactId,
        properties: {
          ...(body.message ? { flow_message: body.message.slice(0, 500) } : {}),
          flow_source: body.source ?? 'flow-contact-form',
        },
      })
    }

    void bus.emit(emitLeadCreated(
      {
        leadId: contactId ?? crypto.randomUUID(),
        email: body.email,
        firstName: body.firstName,
        company: body.company,
        source: body.source ?? 'flow-contact-form',
        appId: 'flow',
        inquiryType: body.inquiryType,
      },
      { orgId: process.env.PLATFORM_ORG_ID ?? 'system', actorId: 'system' },
    ))

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Failed to process contact lead' }, { status: 500 })
  }
}
