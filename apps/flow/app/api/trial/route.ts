import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { upsertFlowLead, createFlowDeal } from '@/lib/services/crm-service'
import { emitTrialStarted } from '@nzila/platform-events/commercial'
import { PlatformEventBus } from '@nzila/platform-events'

const bus = new PlatformEventBus()

const trialSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  company: z.string().min(1),
  teamSize: z.string().optional(),
  primaryUseCase: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = trialSchema.parse(await request.json())
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const contactId = await upsertFlowLead({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      properties: {
        company: body.company,
        ...(body.teamSize ? { flow_team_size: body.teamSize } : {}),
        ...(body.primaryUseCase ? { flow_primary_use_case: body.primaryUseCase } : {}),
        flow_source: 'flow-trial-signup',
        flow_trial_status: 'trialing',
        flow_trial_ends_at: trialEndsAt,
      },
    })

    if (contactId) {
      await createFlowDeal({
        name: `Flow trial - ${body.company}`,
        stage: 'trial_active',
        contactId,
        properties: {
          flow_arr_estimate: body.teamSize && Number(body.teamSize) > 10 ? '12000' : '3000',
          flow_trial_ends_at: trialEndsAt,
          flow_close_probability: '0.25',
        },
      })
    }

    void bus.emit(emitTrialStarted(
      {
        leadId: contactId ?? crypto.randomUUID(),
        email: body.email,
        company: body.company,
        appId: 'flow',
        trialEndsAt,
        teamSize: body.teamSize,
        primaryUseCase: body.primaryUseCase,
      },
      { orgId: process.env.PLATFORM_ORG_ID ?? 'system', actorId: 'system' },
    ))

    return NextResponse.json({ ok: true, trialEndsAt })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Invalid trial payload', details: error.flatten().fieldErrors }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Failed to create trial lead' }, { status: 500 })
  }
}
