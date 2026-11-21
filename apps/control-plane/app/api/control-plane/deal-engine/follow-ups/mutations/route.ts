import { mutateFollowUp } from '@/lib/services/deal-engine-mutations'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const completeMutationSchema = z.object({
  action: z.literal('complete'),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
})

const snoozeMutationSchema = z.object({
  action: z.literal('snooze'),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
  newDueDate: z.string().datetime({ offset: true }),
})

const reassignMutationSchema = z.object({
  action: z.literal('reassign'),
  followUpId: z.string().min(1),
  actor: z.string().min(1),
  newOwner: z.string().min(1),
})

const followUpMutationSchema = z.discriminatedUnion('action', [
  completeMutationSchema,
  snoozeMutationSchema,
  reassignMutationSchema,
])

export async function POST(request: Request) {
  try {
    await requireApiAuth(request)
    const body = await request.json()
    const parsed = followUpMutationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const result = await mutateFollowUp(parsed.data, {
      previousDueDate: body.previousDueDate,
      previousOwner: body.previousOwner,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return handleAuthError(error)
  }
}
