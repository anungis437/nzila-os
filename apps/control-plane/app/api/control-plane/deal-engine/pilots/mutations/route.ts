import { mutatePilot } from '@/lib/services/deal-engine-mutations'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { pilotStatusSchema } from '@nzila/deal-engine/types'

export const dynamic = 'force-dynamic'

const CHECKLIST_KEYS = [
  'dataReceived',
  'ingestionComplete',
  'demoDatasetReady',
  'userOnboardingComplete',
  'reviewMeetingScheduled',
  'conversionTriggered',
] as const

const checklistMutationSchema = z.object({
  action: z.literal('update_checklist'),
  pilotId: z.string().min(1),
  actor: z.string().min(1),
  checklistKey: z.enum(CHECKLIST_KEYS),
  checklistValue: z.boolean(),
})

const statusMutationSchema = z.object({
  action: z.literal('update_status'),
  pilotId: z.string().min(1),
  actor: z.string().min(1),
  status: pilotStatusSchema,
})

const pilotMutationSchema = z.discriminatedUnion('action', [
  checklistMutationSchema,
  statusMutationSchema,
])

export async function POST(request: Request) {
  try {
    await requireApiAuth(request)
    const body = await request.json()
    const parsed = pilotMutationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const result = await mutatePilot(parsed.data, { previousStatus: body.previousStatus })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return handleAuthError(error)
  }
}
