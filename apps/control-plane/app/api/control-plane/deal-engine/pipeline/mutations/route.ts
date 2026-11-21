import { transitionPipeline } from '@/lib/services/deal-engine-mutations'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import { dealStageSchema } from '@nzila/deal-engine/lifecycle'

export const dynamic = 'force-dynamic'

const pipelineMutationSchema = z.object({
  dealId: z.string().min(1),
  toStage: dealStageSchema,
  actor: z.string().min(1),
  reason: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    await requireApiAuth(request)
    const body = await request.json()
    const parsed = pipelineMutationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const result = await transitionPipeline(parsed.data, { fromStage: body.fromStage })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return handleAuthError(error)
  }
}
