import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertZongaLead, createZongaDeal } from '@/lib/services/crm-service'

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

    const contactId = await upsertZongaLead({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      properties: {
        ...(body.organization ? { company: body.organization } : {}),
        ...(body.role ? { jobtitle: body.role } : {}),
        ...(body.inquiryType ? { zonga_inquiry_type: body.inquiryType } : {}),
        zonga_source: body.source ?? 'zonga-contact-form',
      },
    })

    if (contactId) {
      await createZongaDeal({
        name: `Zonga lead - ${body.organization || body.email}`,
        stage: 'inquiry',
        contactId,
        properties: {
          ...(body.message ? { zonga_message: body.message.slice(0, 500) } : {}),
          zonga_source: body.source ?? 'zonga-contact-form',
          zonga_close_probability: '0.20',
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid input', details: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Failed to process contact lead' }, { status: 500 })
  }
}
